import type { DrataActionContext } from "./runtime-request.ts";

import { objectArray } from "../../core/cast.ts";
import { providerInputError, requiredResponseRecord } from "../provider-runtime.ts";
import { readDrataUpload } from "./runtime-evidence.ts";
import { drataPathId, requestDrataJson } from "./runtime-request.ts";

/** Drata's vendor PUT replaces fields; merge a partial change into a fresh record first. */
export async function updateVendor(
  context: DrataActionContext,
  vendorId: unknown,
  changes: Record<string, unknown>,
): Promise<unknown> {
  if (!Object.keys(changes).length) throw providerInputError("Provide at least one vendor field to update.");
  const path = `/vendors/${drataPathId(vendorId, "vendorId")}`;
  const baseUrl = context.baseUrl.replace(/\/v2$/, "");
  const current = requiredResponseRecord(
    await requestDrataJson({ ...context, baseUrl, path, mode: "execute" }),
    "Drata vendor",
  );
  const body = { ...current, ...changes };
  for (const key of ["id", "createdAt", "updatedAt", "deletedAt", "companyId", "documents", "securityReviews"])
    delete body[key];
  return requestDrataJson({ ...context, baseUrl, path, method: "PUT", body, mode: "execute" });
}

/** A bounded bulk update keeps individual failures visible and never retries a successful write. */
export async function updateVendors(context: DrataActionContext, input: unknown): Promise<unknown> {
  const updates = objectArray(input, "updates", providerInputError);
  if (!updates.length || updates.length > 50) throw providerInputError("Provide between 1 and 50 vendor updates.");
  const changes = updates;
  for (const change of changes) {
    drataPathId(change.vendorId, "vendorId");
    if (Object.keys(change).length <= 1) throw providerInputError("Each vendor update must change at least one field.");
  }
  const results = [];
  for (const { vendorId, ...body } of changes) {
    context.signal?.throwIfAborted();
    try {
      results.push({ vendorId, ok: true, vendor: await updateVendor(context, vendorId, body) });
    } catch (error) {
      if (context.signal?.aborted) throw error;
      results.push({ vendorId, ok: false, error: error instanceof Error ? error.message : String(error) });
    }
  }
  return { results };
}

/** Submit a vendor review and its report in one multipart request. */
export async function uploadReview(context: DrataActionContext, input: Record<string, unknown>): Promise<unknown> {
  const file = await readDrataUpload(input.file, context);
  const body = new FormData();
  body.set("file", file, file.name);
  for (const key of [
    "title",
    "reviewDeadlineAt",
    "securityReviewStatus",
    "securityReviewType",
    "requesterUserId",
    "requestedAt",
    "documentType",
  ])
    if (input[key] !== undefined) body.set(key, String(input[key]));
  return requestDrataJson({
    ...context,
    path: `/vendors/${drataPathId(input.vendorId, "vendorId")}/security-reviews/with-file`,
    method: "POST",
    body,
    mode: "execute",
  });
}
