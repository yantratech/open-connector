import type { ActionDefinition } from "../../core/types.ts";

import { s } from "../../core/json-schema.ts";
import { defineProviderAction } from "../../core/provider-definition.ts";
import { drataIdentifier as id, drataRecordOutput, drataWorkspaceId as workspaceId } from "./action-schemas.ts";
const renewalScheduleType = s.stringEnum([
  "ONE_MONTH",
  "TWO_MONTHS",
  "THREE_MONTHS",
  "SIX_MONTHS",
  "ONE_YEAR",
  "CUSTOM",
  "NONE",
]);
const artifact = {
  file: s.transitFile(),
  url: s.url("A URL to attach as evidence."),
  ticketUrl: s.url("A ticket-provider evidence URL."),
  ownerId: id,
  filedAt: s.string("The date the artifact was filed."),
  renewalScheduleType,
  renewalDate: s.string("The custom renewal date."),
};
const details = {
  name: s.nonEmptyString("The evidence display name; defaults to the transit filename for file uploads."),
  description: s.string(),
  implementationGuidance: s.string(),
  controlIds: s.array(id),
};
export const drataEvidenceActions: ActionDefinition[] = [
  {
    name: "create_evidence_library_item",
    description:
      "Create evidence from exactly one file, URL or ticket URL. Artifact uploads require ownerId, filedAt and renewalScheduleType.",
    inputSchema: s.object(
      { workspaceId, ...artifact, ...details },
      { required: ["workspaceId", "ownerId", "filedAt", "renewalScheduleType"] },
    ),
    outputSchema: drataRecordOutput,
  },
  {
    name: "update_evidence_library_item",
    description:
      "Update evidence metadata or replace its artifact. Omitted renewal settings are preserved. Supply at most one artifact source.",
    inputSchema: s.object(
      { workspaceId, itemId: id, ...artifact, ...details },
      { required: ["workspaceId", "itemId"] },
    ),
    outputSchema: drataRecordOutput,
  },
  {
    name: "fulfil_templated_evidence",
    description:
      "Attach an artifact to templated evidence without changing the template's name or description. Requires exactly one artifact source.",
    inputSchema: s.object(
      { workspaceId, itemId: id, ...artifact },
      { required: ["workspaceId", "itemId", "ownerId", "filedAt", "renewalScheduleType"] },
    ),
    outputSchema: drataRecordOutput,
  },
  {
    name: "delete_evidence_library_item",
    description: "Permanently delete an evidence-library item.",
    inputSchema: s.requiredObject("Evidence to delete.", { workspaceId, itemId: id }),
    outputSchema: drataRecordOutput,
  },
  {
    name: "get_evidence_library_item",
    description: "Get one evidence-library item.",
    inputSchema: s.object(
      { workspaceId, itemId: id, expand: s.array(s.string()) },
      { required: ["workspaceId", "itemId"] },
    ),
    outputSchema: drataRecordOutput,
  },
  {
    name: "get_evidence_library_version",
    description: "Get a historical evidence-library version.",
    inputSchema: s.object(
      { workspaceId, itemId: id, versionId: id, expand: s.array(s.string()) },
      { required: ["workspaceId", "itemId", "versionId"] },
    ),
    outputSchema: drataRecordOutput,
  },
  {
    name: "list_external_evidence",
    description:
      "List external uploads attached to a control. An empty collection alone does not prove the control exists.",
    inputSchema: s.object(
      {
        controlId: id,
        page: s.positiveInteger("The V1 page number."),
        size: s.integer({ minimum: 1, maximum: 50 }),
        fetchAll: s.boolean(),
        maxResults: s.integer({ minimum: 1, maximum: 10000 }),
      },
      { required: ["controlId"] },
    ),
    outputSchema: s.looseObject("A bounded V1 evidence page with nextPage metadata."),
  },
  {
    name: "create_control_external_evidence",
    description: "Attach external evidence to a control from exactly one transit file or URL.",
    inputSchema: s.object(
      {
        workspaceId,
        controlId: id,
        name: s.nonEmptyString("The display filename."),
        description: s.string(),
        creationDate: s.string(),
        renewalDate: s.string(),
        renewalScheduleType,
        file: s.transitFile(),
        url: s.url("The evidence URL."),
      },
      { required: ["workspaceId", "controlId", "name", "creationDate", "renewalDate", "renewalScheduleType"] },
    ),
    outputSchema: s.unknown("The uploaded evidence response."),
  },
  {
    name: "get_external_evidence_download_url",
    description: "Get a short-lived signed URL for one external evidence item.",
    inputSchema: s.requiredObject("Evidence to download.", { evidenceId: id }),
    outputSchema: drataRecordOutput,
  },
  {
    name: "delete_external_evidence",
    description: "Permanently delete an external evidence upload.",
    inputSchema: s.requiredObject("Evidence to delete.", { evidenceId: id }),
    outputSchema: drataRecordOutput,
  },
  {
    name: "upload_risk_document",
    description: "Upload a transit file as a risk document.",
    inputSchema: s.requiredObject("The risk document.", { riskRegisterId: id, riskId: id, file: s.transitFile() }),
    outputSchema: s.unknown("The document upload response."),
  },
  {
    name: "upload_vendor_document",
    description: "Upload a transit file to a vendor's document collection.",
    inputSchema: s.requiredObject("The vendor document.", { vendorId: id, file: s.transitFile() }),
    outputSchema: s.unknown("The document upload response."),
  },
  {
    name: "upload_user_document",
    description: "Upload a compliance document for a user. Use the user ID, not the personnel ID.",
    inputSchema: s.requiredObject("The user document.", {
      userId: id,
      file: s.transitFile(),
      type: s.stringEnum(["SEC_TRAINING", "MFA_EVIDENCE", "HIPAA_TRAINING_EVIDENCE", "OFFBOARDING_EVIDENCE"]),
    }),
    outputSchema: s.unknown("The document upload response."),
  },
  {
    name: "upload_offboarding_document",
    description: "Upload evidence of a user's offboarding.",
    inputSchema: s.requiredObject("The offboarding document.", { userId: id, file: s.transitFile() }),
    outputSchema: s.unknown("The document upload response."),
  },
].map((action) => defineProviderAction("drata", action));
