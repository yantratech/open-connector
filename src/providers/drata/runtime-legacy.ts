import type { DrataActionContext } from "./runtime-request.ts";

import { optionalInteger, optionalRecord } from "../../core/cast.ts";
import { providerInputError, providerResponseError } from "../provider-runtime.ts";
import { drataQuery, requestDrataJson } from "./runtime-request.ts";

export interface DrataLegacyPage {
  data: unknown[];
  total: number | null;
  returned: number;
  pagination: { page: number; limit: number; totalCount: number | null; nextPage: number | null };
  raw: Record<string, unknown>;
}

/** V1 uses page/limit and top-level totals, unlike V2's cursor/size envelope. */
export async function readDrataLegacyList(
  context: DrataActionContext,
  path: string,
  input: Record<string, unknown>,
  filters: string[] = [],
): Promise<DrataLegacyPage> {
  const limit = Math.min(
    optionalInteger(input.size ?? input.limit) ?? 50,
    50,
    optionalInteger(input.maxResults) ?? 10000,
  );
  let page = optionalInteger(input.page) ?? 1;
  const budget = optionalInteger(input.maxResults) ?? 10000;
  if (page < 1 || limit < 1 || budget < 1 || budget > 10000)
    throw providerInputError("Use positive page/size values and maxResults between 1 and 10000.");
  const data: unknown[] = [];
  let raw: Record<string, unknown> = {};
  let total: number | null = null;
  let nextPage: number | null = null;
  do {
    const payload = await requestDrataJson({
      ...context,
      baseUrl: context.baseUrl.replace(/\/v2$/, ""),
      path,
      query: { ...drataQuery(input, ["sort", "sortDir", ...filters]), page: String(page), limit: String(limit) },
      mode: "execute",
    });
    raw = optionalRecord(payload) ?? {};
    const rows = Array.isArray(payload) ? payload : raw.data;
    if (!Array.isArray(rows)) throw providerResponseError("Drata returned an invalid V1 list response.");
    total = optionalInteger(raw.total) ?? total;
    if (rows.length > limit) throw providerResponseError("Drata exceeded the requested V1 page size.");
    data.push(...rows);
    nextPage = rows.length === 0 || (total !== null && page * limit >= total) || rows.length < limit ? null : page + 1;
    if (input.fetchAll !== true || nextPage === null || data.length + limit > budget) break;
    page = nextPage;
  } while (data.length < budget);
  return { data, total, returned: data.length, pagination: { page, limit, totalCount: total, nextPage }, raw };
}
