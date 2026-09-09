import type { ProviderActionHandlerSubset, ProviderRuntimeHandler } from "../provider-runtime.ts";
import type { KandjiActionContext } from "./runtime-request.ts";

import { optionalString } from "../../core/cast.ts";
import { providerInputError, requiredInputString } from "../provider-runtime.ts";
import { kandjiPathSegment, readKandjiPage, requestKandjiJson } from "./runtime-request.ts";

export const kandjiLibraryHandlers: ProviderActionHandlerSubset<
  "kandji",
  ProviderRuntimeHandler<KandjiActionContext>
> = {
  list_custom_apps(input, context) {
    return readKandjiPage(context, "/api/v1/library/custom-apps", input);
  },
  get_custom_app(input, context) {
    return libraryRequest(input, context, "custom-apps", "GET");
  },
  create_custom_app(input, context) {
    return libraryRequest(input, context, "custom-apps", "POST");
  },
  update_custom_app(input, context) {
    return libraryRequest(input, context, "custom-apps", "PATCH");
  },
  delete_custom_app(input, context) {
    return libraryRequest(input, context, "custom-apps", "DELETE");
  },
  upload_custom_app_binary(input, context) {
    return requestKandjiJson({
      ...context,
      path: "/api/v1/library/custom-apps/upload",
      method: "POST",
      body: { name: requiredInputString(input.name, "name") },
      phase: "execute",
    });
  },
  list_in_house_apps(input, context) {
    return readKandjiPage(context, "/api/v1/library/ipa-apps", input);
  },
  get_in_house_app(input, context) {
    return libraryRequest(input, context, "ipa-apps", "GET");
  },
  create_in_house_app(input, context) {
    return libraryRequest(input, context, "ipa-apps", "POST");
  },
  update_in_house_app(input, context) {
    return libraryRequest(input, context, "ipa-apps", "PATCH");
  },
  delete_in_house_app(input, context) {
    return libraryRequest(input, context, "ipa-apps", "DELETE");
  },
  upload_in_house_app_binary(input, context) {
    return requestKandjiJson({
      ...context,
      path: "/api/v1/library/ipa-apps/upload",
      method: "POST",
      body: { filename: requiredInputString(input.filename, "filename") },
      phase: "execute",
    });
  },
  list_custom_profiles(input, context) {
    return readKandjiPage(context, "/api/v1/library/custom-profiles", input);
  },
  get_custom_profile(input, context) {
    return libraryRequest(input, context, "custom-profiles", "GET");
  },
  create_custom_profile(input, context) {
    return profileRequest(input, context, true);
  },
  update_custom_profile(input, context) {
    return profileRequest(input, context, false);
  },
  delete_custom_profile(input, context) {
    return libraryRequest(input, context, "custom-profiles", "DELETE");
  },
  list_custom_scripts(input, context) {
    return readKandjiPage(context, "/api/v1/library/custom-scripts", input);
  },
  get_custom_script(input, context) {
    return libraryRequest(input, context, "custom-scripts", "GET");
  },
  create_custom_script(input, context) {
    return libraryRequest(input, context, "custom-scripts", "POST");
  },
  update_custom_script(input, context) {
    return libraryRequest(input, context, "custom-scripts", "PATCH");
  },
  delete_custom_script(input, context) {
    return libraryRequest(input, context, "custom-scripts", "DELETE");
  },
  get_library_item_status(input, context) {
    return readKandjiPage(
      context,
      `/api/v1/library/library-items/${kandjiPathSegment(input.libraryItemId, "libraryItemId")}/status`,
      input,
    );
  },
  get_library_item_activity(input, context) {
    return readKandjiPage(
      context,
      `/api/v1/library/library-items/${kandjiPathSegment(input.libraryItemId, "libraryItemId")}/activity`,
      input,
    );
  },
  list_self_service_categories(_input, context) {
    return requestKandjiJson({ ...context, path: "/api/v1/self-service/categories", phase: "execute" });
  },
};

function libraryRequest(
  input: Record<string, unknown>,
  context: KandjiActionContext,
  family: string,
  method: string,
): Promise<unknown> {
  const { libraryItemId, ...fields } = input;
  const path = `/api/v1/library/${family}${method === "POST" ? "" : `/${kandjiPathSegment(libraryItemId, "libraryItemId")}`}`;
  if (method === "PATCH" && Object.keys(fields).length === 0)
    throw providerInputError("Provide at least one library item field to change.");
  return requestKandjiJson({
    ...context,
    path,
    method,
    body: method === "POST" || method === "PATCH" ? fields : undefined,
    phase: "execute",
  });
}

function profileRequest(
  input: Record<string, unknown>,
  context: KandjiActionContext,
  create: boolean,
): Promise<unknown> {
  const { libraryItemId, mobileconfig, ...fields } = input;
  if (create) {
    const platforms = ["runs_on_mac", "runs_on_iphone", "runs_on_ipad", "runs_on_tv", "runs_on_vision"];
    const specified = platforms.some((key) => fields[key] !== undefined);
    if (specified && !platforms.some((key) => fields[key] === true))
      throw providerInputError("At least one device family must be enabled.");
    if (!specified) fields.runs_on_mac = true;
  }
  const path = `/api/v1/library/custom-profiles${create ? "" : `/${kandjiPathSegment(libraryItemId, "libraryItemId")}`}`;
  let body: unknown = fields;
  if (mobileconfig !== undefined) {
    const form = new FormData();
    for (const [key, value] of Object.entries(fields)) if (value !== undefined) form.set(key, String(value));
    form.set(
      "file",
      new Blob([requiredInputString(mobileconfig, "mobileconfig")], { type: "application/x-apple-aspen-config" }),
      `${optionalString(fields.name) ?? "profile"}.mobileconfig`,
    );
    body = form;
  } else if (create) throw providerInputError("mobileconfig is required.");
  return requestKandjiJson({ ...context, path, method: create ? "POST" : "PATCH", body, phase: "execute" });
}
