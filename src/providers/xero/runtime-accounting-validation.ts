import type { OAuthProviderContext } from "../provider-runtime.ts";

import {
  looseArray,
  objectArray,
  optionalNumber,
  optionalRecord,
  optionalString,
  recordOrEmpty,
} from "../../core/cast.ts";
import { providerInputError, providerResponseError } from "../provider-runtime.ts";
import { xeroRequest } from "./runtime-request.ts";

/** Read the authoritative document state before a state-dependent mutation. */
export async function readXeroAccountingRecord(
  context: OAuthProviderContext,
  tenantId: string,
  entity: string,
  id: string,
): Promise<Record<string, unknown>> {
  const payload = await xeroRequest(context, { tenantId, path: `/${entity}/${id}` });
  const record = optionalRecord(looseArray(recordOrEmpty(payload)[entity])[0]);
  if (!record) throw providerResponseError(`Xero did not return the requested ${entity} record.`);
  return record;
}

export function assertXeroStatus(record: Record<string, unknown>, allowed: string[], operation: string): void {
  const status = optionalString(record.Status);
  if (!status || !allowed.includes(status))
    throw providerInputError(
      `${operation} requires status ${allowed.join(" or ")}; current status is ${status ?? "unknown"}.`,
    );
}

/** Reject empty replacement sets before a document write. */
export function validateXeroLines(input: Record<string, unknown>, required = false): void {
  if (
    (required || input.line_items !== undefined) &&
    objectArray(input.line_items, "line_items", providerInputError).length === 0
  )
    throw providerInputError("line_items must contain at least one line.");
}

/** Journal amounts balance at Xero's supported four-decimal precision. */
export function validateXeroJournal(input: Record<string, unknown>, required = false): void {
  if (!required && input.journal_lines === undefined) return;
  const lines = objectArray(input.journal_lines, "journal_lines", providerInputError);
  if (lines.length < 2) throw providerInputError("journal_lines must contain at least two lines.");
  let sum = 0;
  for (const line of lines) {
    const amount = optionalNumber(line.line_amount);
    if (
      amount === undefined ||
      !Number.isFinite(amount) ||
      !Number.isSafeInteger(Math.round(amount * 10000)) ||
      Math.abs(amount * 10000 - Math.round(amount * 10000)) > 0.000001
    )
      throw providerInputError("Journal line_amount must be finite with at most four decimal places.");
    if (!optionalString(line.account_code) && !optionalString(line.account_id))
      throw providerInputError("Each journal line needs account_code or account_id.");
    sum += Math.round(amount * 10000);
  }
  if (!Number.isSafeInteger(sum) || sum !== 0)
    throw providerInputError("Journal debit and credit amounts must balance.");
}

/** Keep per-element validation and warnings on successful batch HTTP responses. */
export function xeroBatchResult(payload: unknown, key: string, expected: number): Record<string, unknown> {
  const items = looseArray(recordOrEmpty(payload)[key]);
  if (items.length !== expected)
    throw providerResponseError(
      "Xero returned an unexpected batch result count. Some writes may have succeeded; inspect Xero before retrying.",
    );
  const results = items.map((value, index) => {
    const record = recordOrEmpty(value);
    const errors = looseArray(record.ValidationErrors);
    return {
      index,
      success: record.HasErrors !== true && record.HasValidationErrors !== true && errors.length === 0,
      validation_errors: errors,
      warnings: looseArray(record.Warnings),
      record,
    };
  });
  return {
    results,
    succeeded: results.filter((result) => result.success).length,
    failed: results.filter((result) => !result.success).length,
  };
}

export function assertXeroUpdate(body: Record<string, unknown>): void {
  if (Object.keys(body).length === 0) throw providerInputError("Provide at least one writable field to update.");
}
