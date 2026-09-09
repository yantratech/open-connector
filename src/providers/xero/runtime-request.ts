import type { OAuthProviderContext } from "../provider-runtime.ts";

import { looseArray, optionalRecord, optionalString, recordOrEmpty } from "../../core/cast.ts";
import { encodePathSegment, readBoundedResponseBytes } from "../../core/request.ts";
import {
  providerInputError,
  providerResponseError,
  ProviderRequestError,
  requiredInputString,
  runProviderRequest,
} from "../provider-runtime.ts";

export const xeroApiBases: Record<string, string> = {
  accounting: "https://api.xero.com/api.xro/2.0",
  projects: "https://api.xero.com/projects.xro/2.0",
  assets: "https://api.xero.com/assets.xro/1.0",
  payroll: "https://api.xero.com/payroll.xro/2.0",
  files: "https://api.xero.com/files.xro/1.0",
};
interface XeroRequestOptions {
  path: string;
  baseUrl?: string;
  method?: string;
  query?: Record<string, string | undefined>;
  body?: unknown;
  tenantId?: string;
  idempotencyKey?: string;
  responseType?: "json" | "file";
  fileName?: string;
  contentType?: string;
}

/** Send one guarded, bounded Xero request. Mutations are not automatically retried. */
export async function xeroRequest(context: OAuthProviderContext, options: XeroRequestOptions): Promise<unknown> {
  if (options.responseType === "file" && !context.transitFiles)
    throw providerInputError("Transit file storage is required for downloads.");
  return runProviderRequest({ signal: context.signal, label: "Xero" }, async (signal) => {
    const base = options.baseUrl ?? xeroApiBases.accounting!;
    const url = new URL(`${base}${options.path}`);
    if (url.origin !== new URL(base).origin) throw providerInputError("Xero requests must use the selected API host.");
    for (const [key, value] of Object.entries(options.query ?? {}))
      if (value !== undefined) url.searchParams.set(key, value);
    const headers = new Headers({
      authorization: `Bearer ${context.accessToken}`,
      accept:
        options.responseType === "file" ? (options.contentType ?? "application/octet-stream") : "application/json",
      "xero-api-package": "OpenConnector",
    });
    if (options.tenantId) headers.set("xero-tenant-id", options.tenantId);
    if (options.idempotencyKey) {
      if (options.idempotencyKey.length > 128)
        throw providerInputError("idempotency_key must not exceed 128 characters.");
      headers.set("Idempotency-Key", options.idempotencyKey);
    }
    const binary = options.body instanceof Blob,
      form = options.body instanceof FormData;
    if (options.body !== undefined && !form)
      headers.set(
        "content-type",
        binary
          ? (options.contentType ?? ((options.body as Blob).type || "application/octet-stream"))
          : "application/json",
      );
    const response = await context.fetcher(url, {
      method: options.method ?? "GET",
      headers,
      body:
        form || binary
          ? (options.body as FormData | Blob)
          : options.body === undefined
            ? undefined
            : JSON.stringify(options.body),
      signal,
    });
    const bytes = await readBoundedResponseBytes(response, {
      maxBytes:
        options.responseType === "file"
          ? Math.min(context.transitFiles?.maxBytes ?? 10 * 1024 * 1024, 10 * 1024 * 1024)
          : 10 * 1024 * 1024,
      fieldName: "Xero response",
      createError: providerResponseError,
    });
    if (response.ok && options.responseType === "file") {
      if (!context.transitFiles) throw providerInputError("Transit file storage is required for downloads.");
      return context.transitFiles.create(
        new File([Uint8Array.from(bytes)], options.fileName ?? "xero-download", {
          type: response.headers.get("content-type") ?? options.contentType ?? "application/octet-stream",
        }),
      );
    }
    const text = new TextDecoder().decode(bytes);
    let payload: unknown = null;
    if (text.trim()) {
      try {
        payload = JSON.parse(text);
      } catch {
        if (response.ok) throw providerResponseError("Xero returned invalid JSON.");
        payload = text;
      }
    }
    if (!response.ok) {
      const record = recordOrEmpty(payload),
        messages = new Set<string>();
      for (const element of looseArray(record.Elements))
        for (const value of looseArray(optionalRecord(element)?.ValidationErrors)) {
          const message = optionalString(optionalRecord(value)?.Message);
          if (message) messages.add(message);
        }
      const summary =
        optionalString(record.Message) ??
        optionalString(record.Detail) ??
        optionalString(record.detail) ??
        optionalString(payload) ??
        `Xero API returned ${response.status}`;
      if (response.status === 401 && /insufficient_scope/i.test(response.headers.get("www-authenticate") ?? ""))
        throw new ProviderRequestError(
          401,
          "The Xero connection lacks a required scope. Reconnect with this action's requiredScopes.",
        );
      throw new ProviderRequestError(
        response.status,
        messages.size ? `${summary}: ${[...messages].join("; ")}` : summary,
        payload,
      );
    }
    return payload;
  });
}

/** Explicitly select the tenant when an OAuth connection covers multiple organisations. */
export async function resolveTenantId(input: Record<string, unknown>, context: OAuthProviderContext): Promise<string> {
  if (input.tenant_id !== undefined) return requireXeroGuid(input.tenant_id, "tenant_id");
  const connections = await xeroRequest(context, { baseUrl: "https://api.xero.com", path: "/connections" });
  if (!Array.isArray(connections)) throw providerResponseError("Xero returned an invalid connections list.");
  if (connections.length !== 1)
    throw providerInputError(
      connections.length
        ? "This connection has multiple Xero organisations. Pass tenant_id from list_organisations."
        : "No Xero organisation is connected.",
    );
  return requireXeroGuid(recordOrEmpty(connections[0]).tenantId, "tenant_id");
}

/** Validate Xero's UUID resource identifiers before using them in path or where expressions. */
export function requireXeroGuid(value: unknown, field: string): string {
  const id = requiredInputString(value, field);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))
    throw providerInputError(`${field} must be a Xero UUID.`);
  return encodePathSegment(id);
}
