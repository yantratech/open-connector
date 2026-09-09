import { encodePathSegment } from "../../core/request.ts";
import { providerInputError, requiredInputString } from "../provider-runtime.ts";

/** Item and tax codes are not UUIDs, but still must remain one path component. */
export function xeroCodeSegment(value: unknown, field: string): string {
  const code = requiredInputString(value, field);
  if (code === "." || code === "..") throw providerInputError(`${field} must not be a path traversal segment.`);
  return encodePathSegment(code);
}

/** Escape a literal inside Xero's quoted where-expression syntax. */
export function escapeXeroWhereValue(value: string): string {
  return value.replaceAll("\\", "\\\\").replaceAll('"', '\\"');
}
