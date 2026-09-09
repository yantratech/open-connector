import type { OAuthProviderContext } from "../provider-runtime.ts";

import { looseArray, recordOrEmpty } from "../../core/cast.ts";
import { providerInputError } from "../provider-runtime.ts";
import { xeroRequest } from "./runtime-request.ts";

/** Payroll models are regional; these actions implement the New Zealand contract. */
export async function requireNewZealandPayroll(context: OAuthProviderContext, tenantId: string): Promise<void> {
  const payload = recordOrEmpty(await xeroRequest(context, { tenantId, path: "/Organisation" }));
  const organisation = recordOrEmpty(looseArray(payload.Organisations)[0]);
  if (!["NZ", "NZONRAMP"].includes(String(organisation.Version)))
    throw providerInputError(
      "These payroll actions require a New Zealand organisation (Version NZ or NZONRAMP). The selected tenant uses another or unknown payroll region.",
    );
}

/** Payroll NZ uses lower-camel fields with uppercase ID suffixes. */
export function payrollLine(input: Record<string, unknown>): Record<string, unknown> {
  return {
    date: input.date,
    earningsRateID: input.earnings_rate_id,
    trackingItemID: input.tracking_item_id,
    numberOfUnits: input.number_of_units,
  };
}
