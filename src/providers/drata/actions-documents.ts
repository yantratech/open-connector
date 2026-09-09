import type { ActionDefinition } from "../../core/types.ts";

import { s } from "../../core/json-schema.ts";
import { defineProviderAction } from "../../core/provider-definition.ts";
import { drataIdentifier as id, drataPageOutput, drataPageProperties, drataRecordOutput } from "./action-schemas.ts";

const documentPageProperties = {
  cursor: drataPageProperties.cursor,
  size: drataPageProperties.size,
  sort: drataPageProperties.sort,
  sortDir: drataPageProperties.sortDir,
  includeTotalCount: drataPageProperties.includeTotalCount,
  fetchAll: drataPageProperties.fetchAll,
  maxResults: drataPageProperties.maxResults,
};
export const drataDocumentsActions: ActionDefinition[] = [
  {
    name: "list_user_documents_v2",
    description:
      "List documents attached to a user. An empty collection does not prove the parent exists. List-level expansions are not supported.",
    inputSchema: s.object(
      "List documents attached to a user. An empty collection does not prove the parent exists. List-level expansions are not supported.",
      { userId: id, ...documentPageProperties },
      { required: ["userId"] },
    ),
    outputSchema: drataPageOutput,
  },
  {
    name: "get_user_document_v2",
    description: "Get a user document and optionally its download URL.",
    inputSchema: s.object(
      "Get a user document and optionally its download URL.",
      { userId: id, documentId: id, expand: drataPageProperties.expand },
      { required: ["userId", "documentId"] },
    ),
    outputSchema: drataRecordOutput,
  },
  {
    name: "list_device_documents",
    description:
      "List documents attached to a device. An empty collection does not prove the parent exists. List-level expansions are not supported.",
    inputSchema: s.object(
      "List documents attached to a device. An empty collection does not prove the parent exists. List-level expansions are not supported.",
      { deviceId: id, ...drataPageProperties },
      { required: ["deviceId"] },
    ),
    outputSchema: drataPageOutput,
  },
  {
    name: "get_device_document",
    description: "Get a device document and optionally its download URL.",
    inputSchema: s.object(
      "Get a device document and optionally its download URL.",
      { deviceId: id, documentId: id, expand: drataPageProperties.expand },
      { required: ["deviceId", "documentId"] },
    ),
    outputSchema: drataRecordOutput,
  },
  {
    name: "list_vendor_documents_v2",
    description:
      "List documents attached to a vendor. An empty collection does not prove the parent exists. List-level expansions are not supported.",
    inputSchema: s.object(
      "List documents attached to a vendor. An empty collection does not prove the parent exists. List-level expansions are not supported.",
      { vendorId: id, ...drataPageProperties },
      { required: ["vendorId"] },
    ),
    outputSchema: drataPageOutput,
  },
  {
    name: "get_vendor_document_v2",
    description: "Get a vendor document and optionally its download URL.",
    inputSchema: s.object(
      "Get a vendor document and optionally its download URL.",
      { vendorId: id, documentId: id, expand: drataPageProperties.expand },
      { required: ["vendorId", "documentId"] },
    ),
    outputSchema: drataRecordOutput,
  },
  {
    name: "list_risk_documents",
    description:
      "List documents attached to a risk. An empty collection does not prove the parent exists. List-level expansions are not supported.",
    inputSchema: s.object(
      "List documents attached to a risk. An empty collection does not prove the parent exists. List-level expansions are not supported.",
      { riskRegisterId: id, riskId: id, ...drataPageProperties },
      { required: ["riskRegisterId", "riskId"] },
    ),
    outputSchema: drataPageOutput,
  },
  {
    name: "get_risk_document",
    description: "Get a risk document and optionally its download URL.",
    inputSchema: s.object(
      "Get a risk document and optionally its download URL.",
      { riskRegisterId: id, riskId: id, documentId: id, expand: drataPageProperties.expand },
      { required: ["riskRegisterId", "riskId", "documentId"] },
    ),
    outputSchema: drataRecordOutput,
  },
].map((action) => defineProviderAction("drata", action));
