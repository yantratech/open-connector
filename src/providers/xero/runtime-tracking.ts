import type { OAuthProviderContext } from "../provider-runtime.ts";

import { sha256Hex } from "../../core/aws-sigv4.ts";
import { compactObject, objectArray, optionalString, optionalStringArray } from "../../core/cast.ts";
import { ProviderRequestError, providerInputError, requiredInputString } from "../provider-runtime.ts";
import { assertXeroUpdate } from "./runtime-accounting-validation.ts";
import { requireXeroGuid, resolveTenantId, xeroRequest } from "./runtime-request.ts";

/** Xero exposes one tracking-option mutation per request, so preserve each outcome. */
export async function writeXeroTrackingOptions(
  input: Record<string, unknown>,
  context: OAuthProviderContext,
  update: boolean,
): Promise<Record<string, unknown>> {
  const category = requireXeroGuid(input.tracking_category_id, "tracking_category_id");
  const options: Record<string, unknown>[] = update
    ? objectArray(input.options, "options", providerInputError)
    : (optionalStringArray(input.names) ?? []).map((name) => ({ name }));
  if (!options.length || options.length > 10) throw providerInputError("Provide between 1 and 10 tracking options.");
  const writes = options.map((option) => {
    const id = update ? requireXeroGuid(option.tracking_option_id, "tracking_option_id") : undefined;
    const body = compactObject({
      Name: update ? option.name : requiredInputString(option.name, "name"),
      Status: option.status,
    });
    assertXeroUpdate(body);
    return { id, body };
  });
  const tenantId = await resolveTenantId(input, context),
    key = optionalString(input.idempotency_key);
  if (key && key.length > 128) throw providerInputError("idempotency_key must not exceed 128 characters.");
  const results: Record<string, unknown>[] = [];
  for (const [index, write] of writes.entries()) {
    if (context.signal?.aborted) break;
    try {
      const result = await xeroRequest(context, {
        tenantId,
        path: `/TrackingCategories/${category}/Options${write.id ? `/${write.id}` : ""}`,
        method: update ? "POST" : "PUT",
        body: write.body,
        idempotencyKey: key ? sha256Hex(`${key}:${index}`) : undefined,
      });
      results.push({ index, success: true, result });
    } catch (error) {
      if (!(error instanceof ProviderRequestError)) throw error;
      results.push({
        index,
        success: false,
        status: error.status,
        error: error.message,
        outcomeUnknown: error.status >= 500,
      });
      if (error.status === 401 || error.status === 403 || error.status === 429)
        throw new ProviderRequestError(error.status, error.message, {
          upstream: error.details,
          results,
          attempted: results.length,
          not_attempted: options.length - results.length,
        });
      if (error.status >= 500) break;
    }
  }
  return {
    results,
    attempted: results.length,
    not_attempted: options.length - results.length,
    complete: results.length === options.length,
  };
}
