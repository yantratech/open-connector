import { looseArray, optionalRecord, optionalString } from "../../core/cast.ts";
import { providerInputError } from "../provider-runtime.ts";

/** Some tenants ignore createdAtFrom, so apply the same lower bound to the returned page. */
export function filterDrataEvents(page: Record<string, unknown>, since: unknown): Record<string, unknown> {
  const value = optionalString(since);
  if (!value) return page;
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) throw providerInputError("createdAtFrom must be an ISO 8601 timestamp.");
  const data = looseArray(page.data).filter(
    (event) => Date.parse(optionalString(optionalRecord(event)?.createdAt) ?? "") >= timestamp,
  );
  return {
    ...page,
    data,
    returned: data.length,
    total: null,
    note: "The date bound was applied to returned rows; continue with the upstream cursor to read additional matching events.",
  };
}
