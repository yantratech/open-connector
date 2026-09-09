import type { ProviderActionHandlerSubset, ProviderRuntimeHandler, OAuthProviderContext } from "../provider-runtime.ts";

import { optionalScalarString, optionalString, optionalStringArray, recordOrEmpty } from "../../core/cast.ts";
import { encodePathSegment } from "../../core/request.ts";
import {
  providerInputError,
  providerResponseError,
  ProviderRequestError,
  readTransitFileInput,
  requiredInputString,
} from "../provider-runtime.ts";
import { xeroAttachmentEntities } from "./file-types.ts";
import { xeroRequest, resolveTenantId, requireXeroGuid, xeroApiBases } from "./runtime-request.ts";

export const xeroFileHandlers: ProviderActionHandlerSubset<"xero", ProviderRuntimeHandler<OAuthProviderContext>> = {
  async upload_file(input, context) {
    const file = await xeroUploadFile(input.file, context);
    const tenantId = await resolveTenantId(input, context);
    const body = new FormData();
    body.set("name", file.name);
    body.set("filename", file.name);
    body.set("mimeType", file.type || "application/octet-stream");
    body.set(file.name, file, file.name);
    return xeroRequest(context, {
      tenantId,
      baseUrl: xeroApiBases.files,
      path: input.folder_id === undefined ? "/Files" : `/Files/${requireXeroGuid(input.folder_id, "folder_id")}`,
      method: "POST",
      body,
      idempotencyKey: optionalString(input.idempotency_key),
    });
  },
  async list_files(input, context) {
    const tenantId = await resolveTenantId(input, context);
    return xeroRequest(context, { tenantId, baseUrl: xeroApiBases.files, path: "/Files", query: filesQuery(input) });
  },
  async get_file(input, context) {
    const tenantId = await resolveTenantId(input, context);
    return xeroRequest(context, {
      tenantId,
      baseUrl: xeroApiBases.files,
      path: `/Files/${requireXeroGuid(input.file_id, "file_id")}`,
    });
  },
  async create_folder(input, context) {
    const tenantId = await resolveTenantId(input, context);
    return xeroRequest(context, {
      tenantId,
      baseUrl: xeroApiBases.files,
      path: "/Folders",
      method: "POST",
      // The official SDK serializes Folder.name as Name; the OpenAPI required list has a casing typo.
      body: { Name: requiredInputString(input.name, "name") },
      idempotencyKey: optionalString(input.idempotency_key),
    });
  },
  async list_folders(input, context) {
    const tenantId = await resolveTenantId(input, context);
    return xeroRequest(context, {
      tenantId,
      baseUrl: xeroApiBases.files,
      path: "/Folders",
      query: { sort: optionalString(input.sort) },
    });
  },
  async get_folder(input, context) {
    const tenantId = await resolveTenantId(input, context);
    return xeroRequest(context, {
      tenantId,
      baseUrl: xeroApiBases.files,
      path: `/Folders/${requireXeroGuid(input.folder_id, "folder_id")}`,
    });
  },
  async get_files_inbox(input, context) {
    const tenantId = await resolveTenantId(input, context);
    return xeroRequest(context, { tenantId, baseUrl: xeroApiBases.files, path: "/Inbox" });
  },
  async create_file_association(input, context) {
    const tenantId = await resolveTenantId(input, context);
    return xeroRequest(context, {
      tenantId,
      baseUrl: xeroApiBases.files,
      path: `/Files/${requireXeroGuid(input.file_id, "file_id")}/Associations`,
      method: "POST",
      body: {
        ObjectId: requireXeroGuid(input.object_id, "object_id"),
        ObjectGroup: input.object_group,
        ObjectType: input.object_type,
      },
      idempotencyKey: optionalString(input.idempotency_key),
    });
  },
  async list_file_associations(input, context) {
    const tenantId = await resolveTenantId(input, context);
    return xeroRequest(context, {
      tenantId,
      baseUrl: xeroApiBases.files,
      path: `/Files/${requireXeroGuid(input.file_id, "file_id")}/Associations`,
    });
  },
  async list_object_associations(input, context) {
    const tenantId = await resolveTenantId(input, context);
    return xeroRequest(context, {
      tenantId,
      baseUrl: xeroApiBases.files,
      path: `/Associations/${requireXeroGuid(input.object_id, "object_id")}`,
      query: filesQuery(input),
    });
  },
  async get_file_associations_count(input, context) {
    const ids = optionalStringArray(input.object_ids);
    if (!ids?.length || ids.length > 50) throw providerInputError("Provide between 1 and 50 object IDs.");
    const tenantId = await resolveTenantId(input, context);
    return xeroRequest(context, {
      tenantId,
      baseUrl: xeroApiBases.files,
      path: "/Associations/Count",
      query: { ObjectIds: ids.map((id) => requireXeroGuid(id, "object_ids")).join(",") },
    });
  },
  async delete_file_association(input, context) {
    const tenantId = await resolveTenantId(input, context);
    await xeroRequest(context, {
      tenantId,
      baseUrl: xeroApiBases.files,
      path: `/Files/${requireXeroGuid(input.file_id, "file_id")}/Associations/${requireXeroGuid(input.object_id, "object_id")}`,
      method: "DELETE",
    });
    return { deleted: true, file_id: input.file_id, object_id: input.object_id };
  },
  async list_attachments(input, context) {
    const path = attachmentPath(input);
    const tenantId = await resolveTenantId(input, context);
    return xeroRequest(context, { tenantId, path });
  },
  async get_attachment(input, context) {
    const path = attachmentPath(input);
    const tenantId = await resolveTenantId(input, context);
    const payload = recordOrEmpty(await xeroRequest(context, { tenantId, path }));
    const id = requireXeroGuid(input.attachment_id, "attachment_id");
    if (!Array.isArray(payload.Attachments)) throw providerResponseError("Xero returned an invalid attachment list.");
    const match = payload.Attachments.map(recordOrEmpty).find((row) => row.AttachmentID === id);
    if (!match) throw new ProviderRequestError(404, "The attachment was not found on this object.");
    return match;
  },
  async upload_attachment(input, context) {
    const path = attachmentPath(input);
    const file = await xeroUploadFile(input.file, context);
    if (input.include_online !== undefined && !["Invoices", "CreditNotes"].includes(String(input.entity_type)))
      throw providerInputError("include_online applies only to invoices and credit notes.");
    const tenantId = await resolveTenantId(input, context);
    return xeroRequest(context, {
      tenantId,
      path: `${path}/${encodePathSegment(file.name)}`,
      method: "PUT",
      body: file,
      contentType: file.type || "application/octet-stream",
      query: { IncludeOnline: optionalScalarString(input.include_online) },
      idempotencyKey: optionalString(input.idempotency_key),
    });
  },
  async download_attachment(input, context) {
    const path = attachmentPath(input);
    if ((input.attachment_id === undefined) === (input.file_name === undefined))
      throw providerInputError("Provide exactly one attachment_id or file_name.");
    const target =
      input.attachment_id === undefined
        ? encodePathSegment(xeroFileName(input.file_name))
        : requireXeroGuid(input.attachment_id, "attachment_id");
    const tenantId = await resolveTenantId(input, context);
    return xeroRequest(context, {
      tenantId,
      path: `${path}/${target}`,
      responseType: "file",
      fileName: optionalString(input.file_name) ?? `attachment-${input.attachment_id}`,
    });
  },
  async download_document_pdf(input, context) {
    const type = requiredInputString(input.entity_type, "entity_type");
    if (!["Invoices", "Quotes", "PurchaseOrders", "CreditNotes"].includes(type))
      throw providerInputError("This document type does not have a supported PDF endpoint.");
    const tenantId = await resolveTenantId(input, context);
    return xeroRequest(context, {
      tenantId,
      path: `/${type}/${requireXeroGuid(input.entity_id, "entity_id")}/pdf`,
      responseType: "file",
      contentType: "application/pdf",
      fileName: `${type}-${input.entity_id}.pdf`,
    });
  },
  async download_file_content(input, context) {
    const tenantId = await resolveTenantId(input, context);
    const path = `/Files/${requireXeroGuid(input.file_id, "file_id")}`;
    const metadata = recordOrEmpty(await xeroRequest(context, { tenantId, baseUrl: xeroApiBases.files, path }));
    return xeroRequest(context, {
      tenantId,
      baseUrl: xeroApiBases.files,
      path: `${path}/Content`,
      responseType: "file",
      fileName: optionalString(metadata.Name) ?? `file-${input.file_id}`,
    });
  },
  async get_invoice_online_url(input, context) {
    const tenantId = await resolveTenantId(input, context);
    return xeroRequest(context, {
      tenantId,
      path: `/Invoices/${requireXeroGuid(input.invoice_id, "invoice_id")}/OnlineInvoice`,
    });
  },
};

function attachmentPath(input: Record<string, unknown>): string {
  const type = requiredInputString(input.entity_type, "entity_type");
  if (!xeroAttachmentEntities.includes(type)) throw providerInputError("Unsupported attachment entity_type.");
  return `/${type}/${requireXeroGuid(input.entity_id, "entity_id")}/Attachments`;
}
function filesQuery(input: Record<string, unknown>): Record<string, string | undefined> {
  return {
    page: optionalScalarString(input.page) ?? "1",
    pagesize: optionalScalarString(input.page_size) ?? "50",
    sort: optionalString(input.sort),
    direction: optionalString(input.direction),
  };
}
function xeroFileName(value: unknown): string {
  const name = requiredInputString(value, "file name");
  if (
    name === "." ||
    name === ".." ||
    /[<>:"/\\|?*+]/.test(name) ||
    Array.from(name).some((character) => character.codePointAt(0)! < 32)
  )
    throw providerInputError("The filename contains characters Xero does not allow.");
  return name;
}
async function xeroUploadFile(input: unknown, context: OAuthProviderContext): Promise<File> {
  const file = await readTransitFileInput(input, context);
  xeroFileName(file.name);
  if (!file.file.size || file.file.size > 10_000_000)
    throw providerInputError("Xero uploads must contain between 1 byte and 10 MB.");
  return file.file;
}
