import type { TransitFileWriter } from "../../core/types.ts";

import { optionalInteger, optionalRecord, optionalScalarString, optionalString } from "../../core/cast.ts";
import { encodePathSegment, readBoundedResponseBytes } from "../../core/request.ts";
import {
  ProviderRequestError,
  providerInputError,
  providerUserAgent,
  requiredInputString,
  runProviderRequest,
  setSearchParams,
} from "../provider-runtime.ts";

export interface KandjiActionContext {
  apiKey: string;
  apiUrl: string;
  fetcher: typeof fetch;
  transitFiles?: TransitFileWriter;
  signal?: AbortSignal;
}

interface KandjiRequestOptions extends KandjiActionContext {
  path: string;
  query?: Record<string, string | number | boolean | undefined>;
  method?: string;
  body?: unknown;
  responseType?: "json" | "text" | "file";
  fileName?: string;
  phase: "validate" | "execute";
  notFoundAsInvalidInput?: boolean;
}

/** Reject dot segments before inserting caller-provided IDs in an API path. */
export function kandjiPathSegment(value: unknown, field: string): string {
  const id = requiredInputString(value, field);
  if (id === "." || id === "..") throw providerInputError(`${field} must not be a relative path segment.`);
  return encodePathSegment(id);
}

/** Send an authenticated request to the configured Kandji tenant. */
export async function requestKandjiJson(input: KandjiRequestOptions): Promise<unknown> {
  return runProviderRequest({ signal: input.signal, label: "Kandji" }, async (signal) => {
    const url = new URL(input.path, `${input.apiUrl}/`);
    if (url.origin !== new URL(input.apiUrl).origin) {
      throw new ProviderRequestError(400, "Kandji requests must target the configured tenant.");
    }
    setSearchParams(
      url,
      Object.fromEntries(Object.entries(input.query ?? {}).map(([key, value]) => [key, optionalScalarString(value)])),
    );
    const multipart = input.body instanceof FormData;
    const formEncoded = input.body instanceof URLSearchParams;
    const headers = new Headers({
      accept: "application/json",
      authorization: `Bearer ${input.apiKey}`,
      "user-agent": providerUserAgent,
    });
    if (input.body !== undefined && !multipart)
      headers.set("content-type", formEncoded ? "application/x-www-form-urlencoded" : "application/json");
    const response = await input.fetcher(url, {
      method: input.method ?? "GET",
      headers,
      body:
        multipart || formEncoded
          ? (input.body as FormData | URLSearchParams)
          : input.body === undefined
            ? undefined
            : JSON.stringify(input.body),
      signal,
    });
    const bytes = await readBoundedResponseBytes(response, {
      maxBytes: input.responseType === "file" ? (input.transitFiles?.maxBytes ?? 10 * 1024 * 1024) : 10 * 1024 * 1024,
      fieldName: "Kandji response",
      createError: (message) => new ProviderRequestError(502, message),
    });
    const text = new TextDecoder().decode(bytes);
    if (response.ok && input.responseType === "text") return { public_key: text };
    if (response.ok && input.responseType === "file" && !response.headers.get("content-type")?.includes("json")) {
      if (!input.transitFiles) throw providerInputError("Transit file storage is required to download this file.");
      return input.transitFiles.create(
        new File([Uint8Array.from(bytes)], input.fileName ?? "kandji-download", {
          type: response.headers.get("content-type") ?? "application/octet-stream",
        }),
      );
    }
    let payload: unknown = null;
    if (text.trim()) {
      try {
        payload = JSON.parse(text);
      } catch {
        if (response.ok) throw new ProviderRequestError(502, "Kandji returned invalid JSON");
        payload = text;
      }
    }
    if (!response.ok) {
      const record = optionalRecord(payload);
      const message =
        optionalString(payload) ??
        optionalString(record?.detail) ??
        optionalString(record?.message) ??
        optionalString(record?.error) ??
        `Kandji request failed with status ${response.status}`;
      const status =
        input.phase === "validate" && response.status >= 400 && response.status < 500 && response.status !== 429
          ? 400
          : response.status;
      throw new ProviderRequestError(status, message);
    }
    return payload;
  });
}

interface KandjiPage {
  count: number | null;
  returned: number;
  hasMore: boolean;
  nextOffset: number | null;
  items: unknown[];
}

/** Read a bounded slice across Kandji's array, DRF and Prism list envelopes. */
export async function readKandjiPage(
  context: KandjiActionContext,
  path: string,
  input: Record<string, unknown>,
  query: Record<string, string | number | boolean | undefined> = {},
): Promise<KandjiPage> {
  const maxResults = optionalInteger(input.maxResults) ?? 100;
  let offset = optionalInteger(input.offset) ?? 0;
  const items: unknown[] = [];
  let count: number | null = null;
  let hasMore = false;
  if (maxResults < 1 || maxResults > 10_001 || offset < 0)
    throw providerInputError("maxResults must be between 1 and 10000 and offset must be non-negative.");
  while (items.length < maxResults) {
    const limit = Math.min(300, maxResults - items.length);
    const payload = await requestKandjiJson({ ...context, path, query: { ...query, limit, offset }, phase: "execute" });
    const record = optionalRecord(payload);
    const rows = Array.isArray(payload) ? payload : (record?.results ?? record?.data);
    if (!Array.isArray(rows)) throw new ProviderRequestError(502, "Kandji returned an invalid list response.");
    count = optionalInteger(record?.count) ?? optionalInteger(record?.total) ?? count;
    const accepted = rows.slice(0, limit);
    items.push(...accepted);
    offset += accepted.length;
    hasMore =
      rows.length > limit ||
      (record && "next" in record ? record.next !== null : count !== null ? offset < count : rows.length === limit);
    if (accepted.length === 0 && hasMore)
      throw new ProviderRequestError(
        502,
        "Kandji returned an empty page with a continuation; pagination cannot advance.",
      );
    if (!hasMore) break;
  }
  return { count, returned: items.length, hasMore, nextOffset: hasMore ? offset : null, items };
}
