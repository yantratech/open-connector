import type { ProviderActionHandlerSubset, ProviderRuntimeHandler } from "../provider-runtime.ts";
import type { KandjiActionContext } from "./runtime-request.ts";

import { compactObject, optionalString } from "../../core/cast.ts";
import { providerInputError, ProviderRequestError, requiredInputString } from "../provider-runtime.ts";
import { kandjiPathSegment, readKandjiPage, requestKandjiJson } from "./runtime-request.ts";

export const kandjiFleetHandlers: ProviderActionHandlerSubset<"kandji", ProviderRuntimeHandler<KandjiActionContext>> = {
  list_blueprint_templates(input, context) {
    return readKandjiPage(context, "/api/v1/blueprints/templates/", input);
  },
  get_blueprint_library_items(input, context) {
    return readKandjiPage(context, `${blueprintPath(input)}/list-library-items`, input);
  },
  get_blueprint_ota_enrollment_profile(input, context) {
    return requestKandjiJson({
      ...context,
      path: `${blueprintPath(input)}/ota-enrollment-profile`,
      query: { sso: input.sso === true ? true : undefined },
      responseType: "file",
      fileName: "kandji-enroll.mobileconfig",
      phase: "execute",
    });
  },
  create_blueprint(input, context) {
    const body = new URLSearchParams();
    body.set("name", requiredInputString(input.name, "name"));
    if (input.description !== undefined) body.set("description", String(input.description));
    body.set("type", optionalString(input.type) ?? "map");
    if ((input.source_type === undefined) !== (input.source_id === undefined))
      throw providerInputError("Cloning requires both source_type and source_id.");
    if (input.source_type !== undefined) {
      body.set("source.type", String(input.source_type));
      body.set("source.id", String(input.source_id));
    } else if (input.template_id !== undefined) {
      body.set("source.type", "template");
      body.set("source.id", String(input.template_id));
    }
    body.set("enrollment_code.is_active", String(input.enrollment_code_is_active ?? true));
    if (input.enrollment_code !== undefined) body.set("enrollment_code.code", String(input.enrollment_code));
    return requestKandjiJson({ ...context, path: "/api/v1/blueprints", method: "POST", body, phase: "execute" });
  },
  update_blueprint(input, context) {
    const body = compactObject({ name: input.name, description: input.description });
    if (Object.keys(body).length === 0) throw providerInputError("Provide a blueprint name or description to change.");
    return requestKandjiJson({ ...context, path: blueprintPath(input), method: "PATCH", body, phase: "execute" });
  },
  delete_blueprint(input, context) {
    return requestKandjiJson({ ...context, path: blueprintPath(input), method: "DELETE", phase: "execute" });
  },
  assign_library_item(input, context) {
    return changeLibraryAssignment(input, context, "assign_library_item");
  },
  remove_library_item(input, context) {
    return changeLibraryAssignment(input, context, "remove_library_item");
  },
  get_blueprint_routing(_input, context) {
    return requestKandjiJson({ ...context, path: "/api/v1/blueprint-routing/", phase: "execute" });
  },
  get_blueprint_routing_activity(input, context) {
    return readKandjiPage(context, "/api/v1/blueprint-routing/activity", input);
  },
  list_tags(input, context) {
    return readKandjiPage(context, "/api/v1/tags", input);
  },
  create_tag(input, context) {
    return requestKandjiJson({
      ...context,
      path: "/api/v1/tags",
      method: "POST",
      body: { name: requiredInputString(input.name, "name") },
      phase: "execute",
    });
  },
  update_tag(input, context) {
    return requestKandjiJson({
      ...context,
      path: `/api/v1/tags/${kandjiPathSegment(input.tagId, "tagId")}`,
      method: "PATCH",
      body: { name: requiredInputString(input.name, "name") },
      phase: "execute",
    });
  },
  delete_tag(input, context) {
    return requestKandjiJson({
      ...context,
      path: `/api/v1/tags/${kandjiPathSegment(input.tagId, "tagId")}`,
      method: "DELETE",
      phase: "execute",
    });
  },
  get_licensing(_input, context) {
    return requestKandjiJson({ ...context, path: "/api/v1/settings/licensing", phase: "execute" });
  },
  list_ade_integrations(input, context) {
    return readKandjiPage(context, "/api/v1/integrations/apple/ade", input);
  },
  get_ade_integration(input, context) {
    return requestKandjiJson({ ...context, path: adeTokenPath(input), phase: "execute" });
  },
  list_ade_devices_for_token(input, context) {
    return readKandjiPage(context, `${adeTokenPath(input)}/devices`, input);
  },
  list_ade_devices(input, context) {
    return readKandjiPage(context, "/api/v1/integrations/apple/ade/devices", input);
  },
  get_ade_device(input, context) {
    return requestKandjiJson({
      ...context,
      path: `/api/v1/integrations/apple/ade/devices/${kandjiPathSegment(input.adeDeviceId, "adeDeviceId")}`,
      phase: "execute",
    });
  },
  get_ade_public_key(_input, context) {
    return requestKandjiJson({
      ...context,
      path: "/api/v1/integrations/apple/ade/public_key/",
      responseType: "text",
      phase: "execute",
    });
  },
  get_threats(input, context) {
    return readThreats(input, context, "/api/v1/threat-details", "/api/v2/threat/threat-details");
  },
  get_behavioral_detections(input, context) {
    return readThreats(input, context, "/api/v1/behavioral-detections", "/api/v2/threat/behavioral-detections/events");
  },
  async test_connection(_input, context) {
    const page = await readKandjiPage(context, "/api/v1/devices", { maxResults: 1 });
    return { ok: true, devicesReturned: page.returned };
  },
};

function blueprintPath(input: Record<string, unknown>): string {
  return `/api/v1/blueprints/${kandjiPathSegment(input.blueprintId, "blueprintId")}`;
}
function adeTokenPath(input: Record<string, unknown>): string {
  return `/api/v1/integrations/apple/ade/${kandjiPathSegment(input.adeTokenId, "adeTokenId")}`;
}

function changeLibraryAssignment(
  input: Record<string, unknown>,
  context: KandjiActionContext,
  action: string,
): Promise<unknown> {
  return requestKandjiJson({
    ...context,
    path: `${blueprintPath(input)}/${action}`,
    method: "POST",
    body: { library_item_id: requiredInputString(input.libraryItemId, "libraryItemId") },
    phase: "execute",
  });
}

async function readThreats(
  input: Record<string, unknown>,
  context: KandjiActionContext,
  v1Path: string,
  v2Path: string,
): Promise<unknown> {
  for (const path of [v1Path, v2Path]) {
    try {
      return await readKandjiPage(context, path, input, { device_id: optionalString(input.deviceId) });
    } catch (error) {
      if (!(error instanceof ProviderRequestError) || error.status !== 404) throw error;
    }
  }
  return {
    license_gated: true,
    note: "Endpoint detection and response is not enabled for this tenant.",
    returned: 0,
    items: [],
  };
}
