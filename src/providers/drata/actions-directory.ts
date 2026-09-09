import type { ActionDefinition } from "../../core/types.ts";

import { s } from "../../core/json-schema.ts";
import { defineProviderAction } from "../../core/provider-definition.ts";
import {
  drataIdentifier as id,
  drataPageOutput,
  drataPageProperties,
  drataRecordOutput,
  drataWorkspaceId as workspaceId,
} from "./action-schemas.ts";

export const drataDirectoryActions: ActionDefinition[] = [
  {
    name: "list_roles",
    description: "List account roles.",
    inputSchema: s.object("List account roles.", { ...drataPageProperties }, { required: [] }),
    outputSchema: drataPageOutput,
  },
  {
    name: "get_role",
    description: "Get an account role.",
    inputSchema: s.object(
      "Get an account role.",
      { roleId: id, expand: drataPageProperties.expand },
      { required: ["roleId"] },
    ),
    outputSchema: drataRecordOutput,
  },
  {
    name: "list_users",
    description: "List users, optionally restricted to members of a role. User IDs and personnel IDs are distinct.",
    inputSchema: s.object(
      "List users, optionally restricted to members of a role. User IDs and personnel IDs are distinct.",
      { roleId: id, ...drataPageProperties },
      { required: [] },
    ),
    outputSchema: drataPageOutput,
  },
  {
    name: "get_user",
    description: "Get a user by user ID.",
    inputSchema: s.object(
      "Get a user by user ID.",
      { userId: id, expand: drataPageProperties.expand },
      { required: ["userId"] },
    ),
    outputSchema: drataRecordOutput,
  },
  {
    name: "list_control_library",
    description: "Search reusable control templates. Availability depends on the account plan.",
    inputSchema: s.object(
      "Search reusable control templates. Availability depends on the account plan.",
      {
        search: s.string(),
        codes: s.array(s.string()),
        ids: s.array(id),
        excludeIds: s.array(id),
        domain: s.string(),
        category: s.string(),
        frameworkTag: s.string(),
        hasTests: s.boolean(),
        hasPolicies: s.boolean(),
        hasEvidence: s.boolean(),
        hasRisks: s.boolean(),
        ...drataPageProperties,
      },
      { required: [] },
    ),
    outputSchema: drataPageOutput,
  },
  {
    name: "get_control_library_item",
    description: "Get a reusable control template.",
    inputSchema: s.object(
      "Get a reusable control template.",
      { templateId: id, expand: drataPageProperties.expand },
      { required: ["templateId"] },
    ),
    outputSchema: drataRecordOutput,
  },
  {
    name: "list_risk_library",
    description: "Search risk templates for a register.",
    inputSchema: s.object(
      "Search risk templates for a register.",
      { riskRegisterId: id, riskId: id, title: s.string(), description: s.string(), ...drataPageProperties },
      { required: ["riskRegisterId"] },
    ),
    outputSchema: drataPageOutput,
  },
  {
    name: "get_risk_library_item",
    description: "Get a risk template by its library ID.",
    inputSchema: s.object(
      "Get a risk template by its library ID.",
      { riskRegisterId: id, riskLibraryId: id, expand: drataPageProperties.expand },
      { required: ["riskRegisterId", "riskLibraryId"] },
    ),
    outputSchema: drataRecordOutput,
  },
  {
    name: "get_control_requirement_comparison",
    description: "Compare requirement mappings across controls. Empty mappings alone do not prove a control exists.",
    inputSchema: s.object(
      "Compare requirement mappings across controls. Empty mappings alone do not prove a control exists.",
      { workspaceId, controlIds: s.array(id, { minItems: 1, maxItems: 100 }) },
      { required: ["workspaceId", "controlIds"] },
    ),
    outputSchema: s.unknown("Control requirement comparison rows."),
  },
  {
    name: "get_device",
    description: "Get a device and optionally expand its personnel, connection and apps.",
    inputSchema: s.object(
      "Get a device and optionally expand its personnel, connection and apps.",
      { deviceId: id, expand: drataPageProperties.expand },
      { required: ["deviceId"] },
    ),
    outputSchema: drataRecordOutput,
  },
  {
    name: "list_device_apps",
    description: "List a device's installedApp records without guessing separate product and version fields.",
    inputSchema: s.object(
      "List a device's installedApp records without guessing separate product and version fields.",
      { deviceId: id, ...drataPageProperties },
      { required: ["deviceId"] },
    ),
    outputSchema: drataPageOutput,
  },
  {
    name: "list_connection_devices",
    description: "List devices imported by one connection.",
    inputSchema: s.object(
      "List devices imported by one connection.",
      {
        connectionId: id,
        externalId: s.string(),
        macAddress: s.string(),
        serialNumber: s.string(),
        personnelId: id,
        ...drataPageProperties,
      },
      { required: ["connectionId"] },
    ),
    outputSchema: drataPageOutput,
  },
  {
    name: "list_devices_v2",
    description: "List a bounded page of devices, or follow pages within maxResults.",
    inputSchema: s.object(
      "List a bounded page of devices, or follow pages within maxResults.",
      {
        externalId: s.string(),
        macAddress: s.string(),
        serialNumber: s.string(),
        personnelId: id,
        connectionId: id,
        sourceType: s.string(),
        ...drataPageProperties,
      },
      { required: [] },
    ),
    outputSchema: drataPageOutput,
  },
].map((action) => defineProviderAction("drata", action));
