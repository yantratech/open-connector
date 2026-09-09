import type { ProviderActionHandlerSubset, ProviderRuntimeHandler } from "../provider-runtime.ts";
import type { DrataActionContext } from "./runtime-request.ts";

import { drataPathId, drataQuery, readDrataList, requestDrataJson } from "./runtime-request.ts";
import { updateVendor, updateVendors, uploadReview } from "./runtime-vendor-writes.ts";
export const drataVendorsHandlers: ProviderActionHandlerSubset<"drata", ProviderRuntimeHandler<DrataActionContext>> = {
  create_vendor(input, context) {
    return requestDrataJson({
      ...context,
      baseUrl: context.baseUrl.replace(/\/v2$/, ""),
      path: "/vendors",
      method: "POST",
      body: input,
      mode: "execute",
    });
  },
  update_vendor(input, context) {
    const { vendorId, ...changes } = input;
    return updateVendor(context, vendorId, changes);
  },
  archive_vendor(input, context) {
    return updateVendor(context, input.vendorId, { archivedAt: new Date().toISOString() });
  },
  bulk_update_vendors(input, context) {
    return updateVendors(context, input.updates);
  },
  create_asset(input, context) {
    return requestDrataJson({
      ...context,
      baseUrl: context.baseUrl.replace(/\/v2$/, ""),
      path: "/assets",
      method: "POST",
      body: input,
      mode: "execute",
    });
  },
  create_vendor_security_review(input, context) {
    const { vendorId, ...body } = input;
    return requestDrataJson({
      ...context,
      path: `/vendors/${drataPathId(vendorId, "vendorId")}/security-reviews`,
      method: "POST",
      body,
      mode: "execute",
    });
  },
  create_vendor_security_review_with_file(input, context) {
    return uploadReview(context, input);
  },
  list_vendor_security_reviews(input, context) {
    return readDrataList(context, `/vendors/${drataPathId(input.vendorId, "vendorId")}/security-reviews`, input, [
      "statuses",
      "types",
      "decisions",
    ]);
  },
  get_vendor_security_review(input, context) {
    return requestDrataJson({
      ...context,
      path: `/vendors/${drataPathId(input.vendorId, "vendorId")}/security-reviews/${drataPathId(input.securityReviewId, "securityReviewId")}`,
      query: drataQuery(input, ["expand"]),
      mode: "execute",
    });
  },
  list_security_review_actions(input, context) {
    return readDrataList(
      context,
      `/vendors/${drataPathId(input.vendorId, "vendorId")}/security-reviews/${drataPathId(input.securityReviewId, "securityReviewId")}/actions`,
      input,
      [],
    );
  },
  list_security_review_questionnaires(input, context) {
    return readDrataList(
      context,
      `/vendors/${drataPathId(input.vendorId, "vendorId")}/security-reviews/${drataPathId(input.securityReviewId, "securityReviewId")}/security-questionnaires`,
      input,
      [],
    );
  },
  send_vendor_questionnaire(input, context) {
    return requestDrataJson({
      ...context,
      path: `/vendors/${drataPathId(input.vendorId, "vendorId")}/questionnaires`,
      method: "POST",
      body: { recipientEmail: input.recipientEmail, message: input.message },
      mode: "execute",
    });
  },
  list_vendor_questionnaires(input, context) {
    return readDrataList(context, `/vendors/${drataPathId(input.vendorId, "vendorId")}/questionnaires`, input, []);
  },
  get_vendor_questionnaire(input, context) {
    return requestDrataJson({
      ...context,
      path: `/vendors/${drataPathId(input.vendorId, "vendorId")}/questionnaires/${drataPathId(input.questionnaireId, "questionnaireId")}`,
      query: drataQuery(input, []),
      mode: "execute",
    });
  },
  get_vendor_questionnaire_answers(input, context) {
    return requestDrataJson({
      ...context,
      baseUrl: context.baseUrl.replace(/\/v2$/, ""),
      path: `/questionnaires/${drataPathId(input.questionnaireId, "questionnaireId")}/vendor/${drataPathId(input.vendorId, "vendorId")}`,
      mode: "execute",
    });
  },
  create_vendor_type(input, context) {
    return requestDrataJson({ ...context, path: "/vendor-types", method: "POST", body: input, mode: "execute" });
  },
  list_vendor_types(input, context) {
    return readDrataList(context, "/vendor-types", input, []);
  },
};
