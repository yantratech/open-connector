import type { ActionDefinition } from "../../core/types.ts";

import { s } from "../../core/json-schema.ts";
import { defineProviderAction } from "../../core/provider-definition.ts";

const pageProperties = {
  maxResults: s.integer("The maximum records to fetch in this call.", { minimum: 1, maximum: 10000, default: 100 }),
  offset: s.nonNegativeInteger("Resume from this zero-based offset."),
};
const pageInput = s.object("A bounded list request.", pageProperties);
const pageOutput = s.requiredObject("A bounded slice of the matching records.", {
  count: s.nullableInteger("The upstream total, or null when unknown."),
  returned: s.integer(),
  hasMore: s.boolean(),
  nextOffset: s.nullableInteger("The offset to resume from, or null at the end."),
  items: s.array(s.looseObject("A Kandji record.")),
});
const objectOutput = s.looseObject("The requested Kandji resource.");
const blueprintId = s.nonEmptyString("The blueprint ID.");
const blueprintInput = s.requiredObject("The target blueprint.", { blueprintId });
const libraryItemId = s.nonEmptyString("The library item ID.");
const libraryAssignmentInput = s.requiredObject("The blueprint and library item.", { blueprintId, libraryItemId });
const adeTokenId = s.nonEmptyString("The Automated Device Enrollment token ID.");
const tagId = s.nonEmptyString("The tag ID.");

export const kandjiFleetActions: ActionDefinition[] = [
  {
    name: "list_blueprint_templates",
    description: "Read the template categories available for creating blueprints.",
    inputSchema: pageInput,
    outputSchema: pageOutput,
  },
  {
    name: "get_blueprint_library_items",
    description: "Read the library items assigned to a blueprint.",
    inputSchema: s.object(
      "The blueprint library request.",
      { blueprintId, ...pageProperties },
      { required: ["blueprintId"] },
    ),
    outputSchema: pageOutput,
  },
  {
    name: "get_blueprint_ota_enrollment_profile",
    description:
      "Download the signed device enrollment profile, or request the SSO enrollment link. Enrollment profiles contain a tenant secret and must be handled as credentials.",
    inputSchema: s.object(
      "The enrollment profile request.",
      { blueprintId, sso: s.boolean("Request the SSO enrollment link instead of a signed profile.") },
      { required: ["blueprintId"] },
    ),
    outputSchema: objectOutput,
  },
  {
    name: "create_blueprint",
    description: "Create a device blueprint, optionally based on a template or an existing blueprint.",
    inputSchema: s.object(
      "The new blueprint.",
      {
        name: s.nonEmptyString("The blueprint name."),
        description: s.string("The blueprint description."),
        type: s.stringEnum(["classic", "map"]),
        template_id: s.anyOf([s.string(), s.integer()]),
        source_type: s.stringEnum(["template", "blueprint"]),
        source_id: s.anyOf([s.string(), s.integer()]),
        enrollment_code_is_active: s.boolean("Whether enrollment using the code is enabled; defaults to true."),
        enrollment_code: s.string("Use this enrollment code instead of generating one."),
      },
      { required: ["name"] },
    ),
    outputSchema: objectOutput,
  },
  {
    name: "update_blueprint",
    description: "Change a blueprint's name or description.",
    inputSchema: s.object(
      "The blueprint changes.",
      {
        blueprintId,
        name: s.nonEmptyString("The new name."),
        description: s.nullableString("The description, or null to clear it."),
      },
      { required: ["blueprintId"] },
    ),
    outputSchema: objectOutput,
  },
  {
    name: "delete_blueprint",
    description: "Delete a blueprint. Confirm the effect on its enrolled devices before executing.",
    inputSchema: blueprintInput,
    outputSchema: s.unknown("The deletion response."),
  },
  {
    name: "assign_library_item",
    description: "Assign a library item to a blueprint, applying it to the blueprint's devices.",
    inputSchema: libraryAssignmentInput,
    outputSchema: s.unknown("The assignment response."),
  },
  {
    name: "remove_library_item",
    description: "Remove a library item from a blueprint.",
    inputSchema: libraryAssignmentInput,
    outputSchema: s.unknown("The removal response."),
  },
  {
    name: "get_blueprint_routing",
    description: "Read the device enrollment routing configuration.",
    inputSchema: s.object({}),
    outputSchema: objectOutput,
  },
  {
    name: "get_blueprint_routing_activity",
    description: "Read device enrollment routing activity.",
    inputSchema: pageInput,
    outputSchema: pageOutput,
  },
  {
    name: "list_tags",
    description: "Read the tags available for organizing devices.",
    inputSchema: pageInput,
    outputSchema: pageOutput,
  },
  {
    name: "create_tag",
    description: "Create a tag for organizing devices.",
    inputSchema: s.requiredObject("The new tag.", { name: s.nonEmptyString("The tag name.") }),
    outputSchema: objectOutput,
  },
  {
    name: "update_tag",
    description: "Rename a device tag.",
    inputSchema: s.requiredObject("The tag changes.", { tagId, name: s.nonEmptyString("The replacement name.") }),
    outputSchema: objectOutput,
  },
  {
    name: "delete_tag",
    description: "Delete a device tag.",
    inputSchema: s.requiredObject("The tag to delete.", { tagId }),
    outputSchema: s.unknown("The deletion response."),
  },
  {
    name: "get_licensing",
    description: "Read licensing information for the connected tenant.",
    inputSchema: s.object({}),
    outputSchema: objectOutput,
  },
  {
    name: "list_ade_integrations",
    description: "Read Apple Automated Device Enrollment integrations.",
    inputSchema: pageInput,
    outputSchema: pageOutput,
  },
  {
    name: "get_ade_integration",
    description: "Read one Apple Automated Device Enrollment integration.",
    inputSchema: s.requiredObject("The integration to read.", { adeTokenId }),
    outputSchema: objectOutput,
  },
  {
    name: "list_ade_devices_for_token",
    description: "Read devices available through an Apple enrollment token.",
    inputSchema: s.object(
      "The enrollment token devices request.",
      { adeTokenId, ...pageProperties },
      { required: ["adeTokenId"] },
    ),
    outputSchema: pageOutput,
  },
  {
    name: "list_ade_devices",
    description: "Read devices available for Automated Device Enrollment.",
    inputSchema: pageInput,
    outputSchema: pageOutput,
  },
  {
    name: "get_ade_device",
    description: "Read one Automated Device Enrollment device.",
    inputSchema: s.requiredObject("The enrollment device.", { adeDeviceId: s.nonEmptyString("The ADE device ID.") }),
    outputSchema: objectOutput,
  },
  {
    name: "get_ade_public_key",
    description: "Read the PEM public key used to configure Apple Automated Device Enrollment.",
    inputSchema: s.object({}),
    outputSchema: s.requiredObject("The enrollment public key.", { public_key: s.string() }),
  },
  {
    name: "get_threats",
    description: "Read endpoint threats, reporting when the EDR feature is unavailable.",
    inputSchema: s.object("The threat query.", {
      ...pageProperties,
      deviceId: s.string("Restrict results to this device."),
    }),
    outputSchema: s.looseObject("The threat page or structured license availability information."),
  },
  {
    name: "get_behavioral_detections",
    description: "Read endpoint behavioral detections, reporting when the EDR feature is unavailable.",
    inputSchema: s.object("The detections query.", {
      ...pageProperties,
      deviceId: s.string("Restrict results to this device."),
    }),
    outputSchema: s.looseObject("The detections page or structured license availability information."),
  },
  {
    name: "test_connection",
    description: "Check whether the configured token can read device inventory.",
    inputSchema: s.object({}),
    outputSchema: s.requiredObject("The connectivity result.", { ok: s.boolean(), devicesReturned: s.integer() }),
  },
].map((action) => defineProviderAction("kandji", action));
