import type { ActionDefinition } from "../../core/types.ts";

import { s } from "../../core/json-schema.ts";
import { defineProviderAction } from "../../core/provider-definition.ts";

const libraryItemId = s.nonEmptyString("The library item ID.");
const itemInput = s.requiredObject("The library item.", { libraryItemId });
const pageProperties = {
  maxResults: s.integer("The maximum records to fetch.", { minimum: 1, maximum: 10000, default: 100 }),
  offset: s.nonNegativeInteger("The pagination offset."),
};
const pageInput = s.object("The library list request.", pageProperties);
const pageOutput = s.requiredObject("A bounded library page.", {
  count: s.nullableInteger("The upstream total, if known."),
  returned: s.integer(),
  hasMore: s.boolean(),
  nextOffset: s.nullableInteger("The next offset, or null."),
  items: s.array(s.looseObject("A library record.")),
});
const objectOutput = s.looseObject("The library resource returned by Kandji.");
const deletionOutput = s.unknown("The deletion response, or null when no content is returned.");
const assignmentProperties = {
  show_in_self_service: s.boolean("Show this item in Self Service."),
  self_service_category_id: s.nullableString("The Self Service category ID, or null to clear it."),
  blueprints: s.array("Blueprint IDs to assign this item to.", s.string()),
};
const appProperties = {
  name: s.nonEmptyString("The library item name."),
  file_key: s.nonEmptyString("The file key returned by the installer upload action."),
  install_enforcement: s.string("The installation enforcement policy."),
  ...assignmentProperties,
};
const customAppProperties = {
  ...appProperties,
  install_type: s.stringEnum("The installer format.", ["package", "zip", "image"]),
  audit_script: s.nullableString("The audit script."),
  preinstall_script: s.nullableString("The pre-install script."),
  postinstall_script: s.nullableString("The post-install script."),
};
const scriptProperties = {
  name: s.nonEmptyString("The script item name."),
  script: s.nonEmptyString("The audit script; nonzero exit status triggers remediation."),
  remediation_script: s.nullableString("The remediation script."),
  execution_frequency: s.string("How often the script runs."),
  ...assignmentProperties,
};
const profileProperties = {
  name: s.nonEmptyString("The configuration profile name."),
  mobileconfig: s.nonEmptyString("The configuration profile XML."),
  runs_on_mac: s.boolean("Target Macs; defaults to true when no platform is specified."),
  runs_on_iphone: s.boolean(),
  runs_on_ipad: s.boolean(),
  runs_on_tv: s.boolean(),
  runs_on_vision: s.boolean(),
};

export const kandjiLibraryActions: ActionDefinition[] = [
  {
    name: "list_custom_apps",
    description: "Read custom app library items.",
    inputSchema: pageInput,
    outputSchema: pageOutput,
  },
  {
    name: "get_custom_app",
    description: "Read one custom app library item.",
    inputSchema: itemInput,
    outputSchema: objectOutput,
  },
  {
    name: "create_custom_app",
    description: "Create a custom app from an uploaded installer. Assigning blueprints can deploy it to their devices.",
    inputSchema: s.object("The new custom app.", customAppProperties, {
      required: ["name", "file_key", "install_type"],
    }),
    outputSchema: objectOutput,
  },
  {
    name: "update_custom_app",
    description: "Update a custom app's installer, scripts or deployment settings.",
    inputSchema: s.object(
      "The custom app changes.",
      { libraryItemId, ...customAppProperties },
      { required: ["libraryItemId"] },
    ),
    outputSchema: objectOutput,
  },
  {
    name: "delete_custom_app",
    description: "Delete a custom app library item.",
    inputSchema: itemInput,
    outputSchema: deletionOutput,
  },
  {
    name: "upload_custom_app_binary",
    description:
      "Request the signed multipart upload URL and fields for a custom app installer. Upload the binary using those fields, then create or update the app with the returned file key.",
    inputSchema: s.requiredObject("The installer to upload.", {
      name: s.nonEmptyString("The installer filename, such as App.pkg."),
    }),
    outputSchema: objectOutput,
  },
  {
    name: "list_in_house_apps",
    description: "Read in-house iOS app library items.",
    inputSchema: pageInput,
    outputSchema: pageOutput,
  },
  {
    name: "get_in_house_app",
    description: "Read an in-house iOS app library item.",
    inputSchema: itemInput,
    outputSchema: objectOutput,
  },
  {
    name: "create_in_house_app",
    description:
      "Create an in-house iOS app from an uploaded IPA. Assigning blueprints can deploy it to their devices.",
    inputSchema: s.object("The new in-house app.", appProperties, { required: ["name", "file_key"] }),
    outputSchema: objectOutput,
  },
  {
    name: "update_in_house_app",
    description: "Update an in-house app's installer or deployment settings.",
    inputSchema: s.object(
      "The in-house app changes.",
      { libraryItemId, ...appProperties },
      { required: ["libraryItemId"] },
    ),
    outputSchema: objectOutput,
  },
  {
    name: "delete_in_house_app",
    description: "Delete an in-house app library item.",
    inputSchema: itemInput,
    outputSchema: deletionOutput,
  },
  {
    name: "upload_in_house_app_binary",
    description:
      "Request the signed multipart upload URL and fields for an IPA. Upload the binary using those fields, then create or update the app with the returned file key.",
    inputSchema: s.requiredObject("The IPA to upload.", { filename: s.nonEmptyString("The IPA filename.") }),
    outputSchema: objectOutput,
  },
  {
    name: "list_custom_profiles",
    description: "Read custom configuration profiles.",
    inputSchema: pageInput,
    outputSchema: pageOutput,
  },
  {
    name: "get_custom_profile",
    description: "Read one custom configuration profile.",
    inputSchema: itemInput,
    outputSchema: objectOutput,
  },
  {
    name: "create_custom_profile",
    description:
      "Create a configuration profile for at least one device family. Defaults to macOS when no family is specified.",
    inputSchema: s.object("The new configuration profile.", profileProperties, { required: ["name", "mobileconfig"] }),
    outputSchema: objectOutput,
  },
  {
    name: "update_custom_profile",
    description: "Update a profile's metadata or replace its configuration payload.",
    inputSchema: s.object(
      "The profile changes.",
      { libraryItemId, ...profileProperties },
      { required: ["libraryItemId"] },
    ),
    outputSchema: objectOutput,
  },
  {
    name: "delete_custom_profile",
    description: "Delete a custom configuration profile.",
    inputSchema: itemInput,
    outputSchema: deletionOutput,
  },
  {
    name: "list_custom_scripts",
    description: "Read custom script library items.",
    inputSchema: pageInput,
    outputSchema: pageOutput,
  },
  {
    name: "get_custom_script",
    description: "Read a custom script and its execution settings.",
    inputSchema: itemInput,
    outputSchema: objectOutput,
  },
  {
    name: "create_custom_script",
    description: "Create an audit and remediation script item. Assigning blueprints can execute it on their devices.",
    inputSchema: s.object("The new script item.", scriptProperties, { required: ["name", "script"] }),
    outputSchema: objectOutput,
  },
  {
    name: "update_custom_script",
    description: "Update a script or its execution and assignment settings.",
    inputSchema: s.object(
      "The script changes.",
      { libraryItemId, ...scriptProperties },
      { required: ["libraryItemId"] },
    ),
    outputSchema: objectOutput,
  },
  {
    name: "delete_custom_script",
    description: "Delete a custom script library item.",
    inputSchema: itemInput,
    outputSchema: deletionOutput,
  },
  {
    name: "get_library_item_status",
    description: "Read device compliance status for a library item.",
    inputSchema: s.object(
      "The library item status request.",
      { libraryItemId, ...pageProperties },
      { required: ["libraryItemId"] },
    ),
    outputSchema: pageOutput,
  },
  {
    name: "get_library_item_activity",
    description: "Read deployment activity for a library item.",
    inputSchema: s.object(
      "The library activity request.",
      { libraryItemId, ...pageProperties },
      { required: ["libraryItemId"] },
    ),
    outputSchema: pageOutput,
  },
  {
    name: "list_self_service_categories",
    description: "Read the categories available in device Self Service.",
    inputSchema: s.object({}),
    outputSchema: s.array(s.looseObject("A Self Service category.")),
  },
].map((action) => defineProviderAction("kandji", action));
