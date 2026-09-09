import type { ProviderActionHandlerSubset, ProviderRuntimeHandler } from "../provider-runtime.ts";
import type { DrataActionContext } from "./runtime-request.ts";

import { drataPathId, drataQuery, readDrataList, requestDrataJson } from "./runtime-request.ts";

export const drataDocumentsHandlers: ProviderActionHandlerSubset<
  "drata",
  ProviderRuntimeHandler<DrataActionContext>
> = {
  list_user_documents_v2(input, context) {
    return readDrataList(
      context,
      `/users/${drataPathId(input.userId, "userId")}/documents`,
      { ...input, expand: undefined },
      [],
    );
  },
  get_user_document_v2(input, context) {
    return requestDrataJson({
      ...context,
      path: `/users/${drataPathId(input.userId, "userId")}/documents/${drataPathId(input.documentId, "documentId")}`,
      query: drataQuery(input, ["expand"]),
      mode: "execute",
    });
  },
  list_device_documents(input, context) {
    return readDrataList(
      context,
      `/devices/${drataPathId(input.deviceId, "deviceId")}/documents`,
      { ...input, expand: undefined },
      [],
    );
  },
  get_device_document(input, context) {
    return requestDrataJson({
      ...context,
      path: `/devices/${drataPathId(input.deviceId, "deviceId")}/documents/${drataPathId(input.documentId, "documentId")}`,
      query: drataQuery(input, ["expand"]),
      mode: "execute",
    });
  },
  list_vendor_documents_v2(input, context) {
    return readDrataList(
      context,
      `/vendors/${drataPathId(input.vendorId, "vendorId")}/documents`,
      { ...input, expand: undefined },
      [],
    );
  },
  get_vendor_document_v2(input, context) {
    return requestDrataJson({
      ...context,
      path: `/vendors/${drataPathId(input.vendorId, "vendorId")}/documents/${drataPathId(input.documentId, "documentId")}`,
      query: drataQuery(input, ["expand"]),
      mode: "execute",
    });
  },
  list_risk_documents(input, context) {
    return readDrataList(
      context,
      `/risk-registers/${drataPathId(input.riskRegisterId, "riskRegisterId")}/risks/${drataPathId(input.riskId, "riskId")}/documents`,
      { ...input, expand: undefined },
      [],
    );
  },
  get_risk_document(input, context) {
    return requestDrataJson({
      ...context,
      path: `/risk-registers/${drataPathId(input.riskRegisterId, "riskRegisterId")}/risks/${drataPathId(input.riskId, "riskId")}/documents/${drataPathId(input.documentId, "documentId")}`,
      query: drataQuery(input, ["expand"]),
      mode: "execute",
    });
  },
};
