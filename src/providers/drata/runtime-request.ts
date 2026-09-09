import type { TransitFileWriter } from "../../core/types.ts";

import { optionalInteger, optionalRecord, optionalScalarString, optionalString } from "../../core/cast.ts";
import { encodePathSegment, readBoundedResponseBytes } from "../../core/request.ts";
import {
  ProviderRequestError,
  providerInputError,
  providerResponseError,
  providerUserAgent,
  runProviderRequest,
} from "../provider-runtime.ts";

export interface DrataActionContext {
  apiKey: string;
  baseUrl: string;
  githubToken?: string;
  fetcher: typeof fetch;
  transitFiles?: TransitFileWriter;
  signal?: AbortSignal;
}

interface DrataRequestOptions extends DrataActionContext {
  path: string;
  mode: "validate" | "execute";
  query?: Record<string, string | string[] | undefined>;
  method?: string;
  body?: unknown;
  responseType?: "json" | "text" | "file";
  fileName?: string;
}

/** Encode Drata's numeric IDs and prefixed identifiers without permitting path traversal. */
export function drataPathId(value: unknown, field: string): string {
  const id = optionalScalarString(value);
  if (!id || id === "." || id === "..") throw providerInputError(`${field} must be an ID or a non-empty identifier.`);
  return encodePathSegment(id);
}

/** Execute an authenticated request against the configured Drata region. */
export async function requestDrataJson(options: DrataRequestOptions): Promise<unknown> {
  return runProviderRequest({ signal: options.signal, label: "Drata" }, async (signal) => {
    const url = new URL(`${options.baseUrl}${options.path}`);
    if (url.origin !== new URL(options.baseUrl).origin)
      throw providerInputError("Drata requests must use the configured API host.");
    for (const [key, value] of Object.entries(options.query ?? {})) {
      if (Array.isArray(value)) for (const item of value) url.searchParams.append(key, item);
      else if (value !== undefined) url.searchParams.set(key, value);
    }
    const multipart = options.body instanceof FormData;
    const headers = new Headers({
      accept: options.responseType === "text" ? "text/html" : "application/json",
      authorization: `Bearer ${options.apiKey}`,
      "user-agent": providerUserAgent,
    });
    if (options.body !== undefined && !multipart) headers.set("content-type", "application/json");
    const response = await options.fetcher(url, {
      method: options.method ?? "GET",
      headers,
      body: multipart
        ? (options.body as FormData)
        : options.body === undefined
          ? undefined
          : JSON.stringify(options.body),
      signal,
    });
    const bytes = await readBoundedResponseBytes(response, {
      maxBytes:
        options.responseType === "file" ? (options.transitFiles?.maxBytes ?? 10 * 1024 * 1024) : 10 * 1024 * 1024,
      fieldName: "Drata response",
      createError: providerResponseError,
    });
    if (response.ok && options.responseType === "file") {
      if (!options.transitFiles) throw providerInputError("Transit file storage is required for downloads.");
      return options.transitFiles.create(
        new File([Uint8Array.from(bytes)], options.fileName ?? "drata-download", {
          type: response.headers.get("content-type") ?? "application/octet-stream",
        }),
      );
    }
    const text = new TextDecoder().decode(bytes);
    if (response.ok && options.responseType === "text")
      return { content: text, contentType: response.headers.get("content-type") };
    let payload: unknown = null;
    if (text.trim()) {
      try {
        payload = JSON.parse(text);
      } catch {
        if (response.ok) throw providerResponseError("Drata returned an invalid JSON response");
        payload = text;
      }
    }
    if (!response.ok) {
      const record = optionalRecord(payload);
      const message =
        optionalString(record?.message) ??
        optionalString(record?.error) ??
        optionalString(payload) ??
        `Drata API request failed with status ${response.status}`;
      const status =
        options.mode === "validate" && (response.status === 401 || response.status === 403) ? 400 : response.status;
      throw new ProviderRequestError(status, message);
    }
    return payload;
  });
}

/** Serialize Drata's scalar and repeated-array query parameters using the API's bracket notation. */
export function drataQuery(
  input: Record<string, unknown>,
  fields: string[],
): Record<string, string | string[] | undefined> {
  const query: Record<string, string | string[] | undefined> = {};
  for (const field of fields) {
    const value = input[field];
    if (Array.isArray(value)) query[`${field}[]`] = value.map((item) => String(item));
    else query[field] = optionalScalarString(value);
  }
  return query;
}

/** Preserve the distinction between one page's size and the full query's total. */
export function drataListResult(payload: unknown, key: string, requestedCursor?: unknown): Record<string, unknown> {
  const record = optionalRecord(payload);
  const items = Array.isArray(payload) ? payload : (record?.data ?? record?.documents);
  if (!Array.isArray(items)) throw providerResponseError("Drata returned an invalid list response.");
  const pagination = optionalRecord(record?.pagination) ?? { cursor: null };
  const cursor = optionalString(pagination.cursor) ?? null;
  return {
    total: optionalInteger(pagination.totalCount) ?? (!cursor && !requestedCursor ? items.length : null),
    returned: items.length,
    pagination,
    [key]: items,
  };
}

/** Read Drata cursor pages with a finite result budget and honest continuation metadata. */
export async function readDrataList(
  context: DrataActionContext,
  path: string,
  input: Record<string, unknown>,
  fields: string[] = [],
  baseUrl: string = context.baseUrl,
): Promise<Record<string, unknown>> {
  const query = drataQuery(input, ["cursor", "size", "sort", "sortDir", "includeTotalCount", "expand", ...fields]);
  query.size ??= "100";
  if (!Number.isInteger(Number(query.size)) || Number(query.size) < 1 || Number(query.size) > 500)
    throw providerInputError("size must be between 1 and 500.");
  const budget = optionalInteger(input.maxResults) ?? 1000;
  if (budget < 1 || budget > 10000) throw providerInputError("maxResults must be between 1 and 10000.");
  const data: unknown[] = [];
  const seen = new Set<string>();
  let result: Record<string, unknown>;
  let knownTotal: number | null = null;
  do {
    if (input.fetchAll === true) query.size = String(Math.min(Number(query.size), budget - data.length));
    const payload = await requestDrataJson({ ...context, baseUrl, path, query, mode: "execute" });
    result = drataListResult(payload, "data", query.cursor);
    const page = result.data as unknown[];
    knownTotal = optionalInteger(result.total) ?? knownTotal;
    if (page.length > Number(query.size)) throw providerResponseError("Drata exceeded the requested page size.");
    data.push(...page);
    const cursor = optionalString(optionalRecord(result.pagination)?.cursor);
    if (cursor && page.length === 0)
      throw providerResponseError("Drata returned an empty page with a continuation cursor.");
    if (input.fetchAll !== true || !cursor || data.length >= budget) break;
    if (seen.has(cursor)) throw providerResponseError("Drata repeated a pagination cursor.");
    seen.add(cursor);
    query.cursor = cursor;
  } while (data.length < budget);
  const pagination = optionalRecord(result!.pagination) ?? {};
  const complete = !pagination.cursor;
  return {
    ...result!,
    total: input.fetchAll === true && complete && !input.cursor ? data.length : knownTotal,
    returned: data.length,
    data,
  };
}

/** Workspace-scoped resources use the caller's explicit workspace selection. */
export function drataWorkspacePath(input: Record<string, unknown>): string {
  return `/workspaces/${drataPathId(input.workspaceId, "workspaceId")}`;
}
