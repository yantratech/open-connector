import type { ProviderActionHandlerSubset, ProviderRuntimeHandler } from "../provider-runtime.ts";
import type { DrataActionContext } from "./runtime-request.ts";

import { Buffer } from "node:buffer";
import { compactObject, optionalString } from "../../core/cast.ts";
import {
  providerInputError,
  readTransitFileInput,
  requiredInputString,
  requiredResponseRecord,
} from "../provider-runtime.ts";
import { readDrataLegacyList } from "./runtime-legacy.ts";
import { drataPathId, drataQuery, drataWorkspacePath, requestDrataJson } from "./runtime-request.ts";

export const drataEvidenceHandlers: ProviderActionHandlerSubset<"drata", ProviderRuntimeHandler<DrataActionContext>> = {
  async create_evidence_library_item(input, context) {
    const body = await evidencePayload(input, context, true);
    body.name = requiredInputString(
      input.name ?? (input.file ? (await readDrataUpload(input.file, context)).name : undefined),
      "name",
    );
    return requestDrataJson({
      ...context,
      path: `${drataWorkspacePath(input)}/evidence-library`,
      method: "POST",
      body,
      mode: "execute",
    });
  },
  async update_evidence_library_item(input, context) {
    const body = await evidencePayload(input, context, false);
    if (input.renewalScheduleType === undefined) {
      const current = requiredResponseRecord(
        await requestDrataJson({ ...context, path: evidencePath(input), mode: "execute" }),
        "Drata evidence",
      );
      body.renewalScheduleType = current.renewalScheduleType;
      if (current.renewalScheduleType === "CUSTOM" && input.renewalDate === undefined)
        body.renewalDate = current.renewalDate;
    }
    return requestDrataJson({ ...context, path: evidencePath(input), method: "PUT", body, mode: "execute" });
  },
  async fulfil_templated_evidence(input, context) {
    const body = await evidencePayload(input, context, true);
    return requestDrataJson({ ...context, path: evidencePath(input), method: "PUT", body, mode: "execute" });
  },
  async delete_evidence_library_item(input, context) {
    await requestDrataJson({ ...context, path: evidencePath(input), method: "DELETE", mode: "execute" });
    return { deleted: true, itemId: input.itemId };
  },
  get_evidence_library_item(input, context) {
    return requestDrataJson({
      ...context,
      path: evidencePath(input),
      query: drataQuery(input, ["expand"]),
      mode: "execute",
    });
  },
  get_evidence_library_version(input, context) {
    return requestDrataJson({
      ...context,
      path: `${evidencePath(input)}/versions/${drataPathId(input.versionId, "versionId")}`,
      query: drataQuery(input, ["expand"]),
      mode: "execute",
    });
  },
  list_external_evidence(input, context) {
    return readDrataLegacyList(
      context,
      `/controls/${drataPathId(input.controlId, "controlId")}/external-evidence`,
      input,
    );
  },
  async create_control_external_evidence(input, context) {
    if ([input.file, input.url].filter((value) => value !== undefined).length !== 1)
      throw providerInputError("Provide exactly one of file or url.");
    const body = new FormData();
    body.set("filename", requiredInputString(input.name, "name"));
    for (const field of ["creationDate", "renewalDate", "renewalScheduleType", "description", "url"]) {
      const value = optionalString(input[field]);
      if (value !== undefined) body.set(field, value);
    }
    if (input.file) {
      const file = await readDrataUpload(input.file, context);
      body.set("file", file, file.name);
    }
    return requestDrataJson({
      ...context,
      baseUrl: context.baseUrl.replace(/\/v2$/, ""),
      path: `${drataWorkspacePath(input)}/controls/${drataPathId(input.controlId, "controlId")}/external-evidence`,
      method: "POST",
      body,
      mode: "execute",
    });
  },
  async get_external_evidence_download_url(input, context) {
    return {
      result: await requestDrataJson({
        ...context,
        baseUrl: context.baseUrl.replace(/\/v2$/, ""),
        path: `/external-evidence/${drataPathId(input.evidenceId, "evidenceId")}/download`,
        mode: "execute",
      }),
      note: "The signed URL is short lived. Download it promptly and do not treat it as a durable evidence link.",
    };
  },
  async delete_external_evidence(input, context) {
    await requestDrataJson({
      ...context,
      baseUrl: context.baseUrl.replace(/\/v2$/, ""),
      path: `/external-evidence/${drataPathId(input.evidenceId, "evidenceId")}`,
      method: "DELETE",
      mode: "execute",
    });
    return { deleted: true, evidenceId: input.evidenceId };
  },
  async upload_risk_document(input, context) {
    const file = await readDrataUpload(input.file, context);
    const body = new FormData();
    body.set("files", file, file.name);
    return requestDrataJson({
      ...context,
      path: `/risk-registers/${drataPathId(input.riskRegisterId, "riskRegisterId")}/risks/${drataPathId(input.riskId, "riskId")}/documents`,
      method: "POST",
      body,
      mode: "execute",
    });
  },
  async upload_vendor_document(input, context) {
    const file = await readDrataUpload(input.file, context);
    const body = new FormData();
    body.set("file", file, file.name);
    return requestDrataJson({
      ...context,
      baseUrl: context.baseUrl.replace(/\/v2$/, ""),
      path: `/vendors/${drataPathId(input.vendorId, "vendorId")}/documents`,
      method: "POST",
      body,
      mode: "execute",
    });
  },
  upload_user_document(input, context) {
    return uploadUserDocument(input, context, false);
  },
  upload_offboarding_document(input, context) {
    return uploadUserDocument({ ...input, type: "OFFBOARDING_EVIDENCE" }, context, true);
  },
};

/** Validate a stored document before sending it to Drata's compliance upload endpoints. */
export async function readDrataUpload(input: unknown, context: DrataActionContext): Promise<File> {
  const stored = await readTransitFileInput(input, context);
  if (stored.file.size === 0 || stored.file.size > 25 * 1024 * 1024)
    throw providerInputError("Drata documents must contain between 1 byte and 25 MiB.");
  if (!/\.(pdf|png|jpe?g|xlsx|docx|odt|doc|ods|pptx|odp|gif)$/i.test(stored.name))
    throw providerInputError("The document filename must have a supported office, PDF or image extension.");
  if (/[/\\]/.test(stored.name) || Array.from(stored.name).some((character) => character.codePointAt(0)! < 32))
    throw providerInputError("The document name must be a filename without path components or control characters.");
  return stored.file;
}

function evidencePath(input: Record<string, unknown>): string {
  return `${drataWorkspacePath(input)}/evidence-library/${drataPathId(input.itemId, "itemId")}`;
}
async function evidencePayload(
  input: Record<string, unknown>,
  context: DrataActionContext,
  requireSource: boolean,
): Promise<Record<string, unknown>> {
  const sources = [input.file, input.url, input.ticketUrl].filter((value) => value !== undefined).length;
  if (sources > 1 || (requireSource && sources !== 1))
    throw providerInputError("Provide exactly one artifact source: file, url or ticketUrl.");
  if (sources) {
    drataPathId(input.ownerId, "ownerId");
    requiredInputString(input.filedAt, "filedAt");
    requiredInputString(input.renewalScheduleType, "renewalScheduleType");
  }
  if (input.renewalScheduleType === "CUSTOM" && !input.renewalDate)
    throw providerInputError("renewalDate is required for a CUSTOM renewal schedule.");
  if (
    input.renewalScheduleType !== undefined &&
    input.renewalScheduleType !== "CUSTOM" &&
    input.renewalDate !== undefined
  )
    throw providerInputError("renewalDate is only valid for a CUSTOM renewal schedule.");
  const body: Record<string, unknown> = compactObject({
    name: input.name,
    description: input.description,
    implementationGuidance: input.implementationGuidance,
    ownerId: input.ownerId,
    controlIds: input.controlIds,
    filedAt: input.filedAt,
    renewalScheduleType: input.renewalScheduleType,
    renewalDate: input.renewalDate,
    url: input.url,
    ticketUrl: input.ticketUrl,
  });
  if (input.file)
    body.base64File = Buffer.from(await (await readDrataUpload(input.file, context)).arrayBuffer()).toString("base64");
  if (!Object.keys(body).length) throw providerInputError("Provide evidence fields to change.");
  return body;
}
async function uploadUserDocument(
  input: Record<string, unknown>,
  context: DrataActionContext,
  v2: boolean,
): Promise<unknown> {
  const file = await readDrataUpload(input.file, context);
  const body = new FormData();
  body.set("type", requiredInputString(input.type, "type"));
  body.set("file", file, file.name);
  return requestDrataJson({
    ...context,
    baseUrl: v2 ? context.baseUrl : context.baseUrl.replace(/\/v2$/, ""),
    path: `/users/${drataPathId(input.userId, "userId")}/documents`,
    method: "POST",
    body,
    mode: "execute",
  });
}
