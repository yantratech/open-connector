import type { ActionDefinition } from "../../core/types.ts";

import { s } from "../../core/json-schema.ts";
import { defineProviderAction } from "../../core/provider-definition.ts";
import { drataIdentifier as id, drataPageOutput, drataPageProperties, drataRecordOutput } from "./action-schemas.ts";

export const drataCustomActions: ActionDefinition[] = [
  {
    name: "list_custom_connections",
    description: "List custom connections.",
    inputSchema: s.object("List custom connections.", { ...drataPageProperties }, { required: [] }),
    outputSchema: drataPageOutput,
  },
  {
    name: "create_custom_connection",
    description: "Create a custom data connection.",
    inputSchema: s.object(
      "Create a custom data connection.",
      { name: s.nonEmptyString("The connection name."), description: s.string() },
      { required: ["name"] },
    ),
    outputSchema: drataRecordOutput,
  },
  {
    name: "list_custom_data_records",
    description: "list custom data records. Custom resource fields are defined by the connection schema.",
    inputSchema: s.object(
      "list custom data records. Custom resource fields are defined by the connection schema.",
      { connectionId: id, resourceId: id, ...drataPageProperties },
      { required: ["connectionId", "resourceId"] },
    ),
    outputSchema: drataPageOutput,
  },
  {
    name: "list_custom_data_records_sessions",
    description: "list custom data records sessions. Custom resource fields are defined by the connection schema.",
    inputSchema: s.object(
      "list custom data records sessions. Custom resource fields are defined by the connection schema.",
      { connectionId: id, resourceId: id, ...drataPageProperties },
      { required: ["connectionId", "resourceId"] },
    ),
    outputSchema: drataPageOutput,
  },
  {
    name: "push_connection_records",
    description: "push connection records. Custom resource fields are defined by the connection schema.",
    inputSchema: s.object(
      "push connection records. Custom resource fields are defined by the connection schema.",
      {
        connectionId: id,
        resourceId: id,
        data: s.looseObject("A record matching the custom resource schema configured in Drata."),
      },
      { required: ["connectionId", "resourceId", "data"] },
    ),
    outputSchema: s.unknown("The custom data operation response."),
  },
  {
    name: "upsert_custom_data_records",
    description: "upsert custom data records. Custom resource fields are defined by the connection schema.",
    inputSchema: s.object(
      "upsert custom data records. Custom resource fields are defined by the connection schema.",
      {
        connectionId: id,
        resourceId: id,
        data: s.looseObject("A record matching the custom resource schema configured in Drata."),
      },
      { required: ["connectionId", "resourceId", "data"] },
    ),
    outputSchema: s.unknown("The custom data operation response."),
  },
  {
    name: "upsert_custom_data_records_session",
    description: "upsert custom data records session. Custom resource fields are defined by the connection schema.",
    inputSchema: s.object(
      "upsert custom data records session. Custom resource fields are defined by the connection schema.",
      {
        connectionId: id,
        resourceId: id,
        sessionId: id,
        data: s.looseObject("A record matching the custom resource schema configured in Drata."),
      },
      { required: ["connectionId", "resourceId", "sessionId", "data"] },
    ),
    outputSchema: s.unknown("The custom data operation response."),
  },
  {
    name: "perform_custom_data_session_action",
    description: "perform custom data session action. Custom resource fields are defined by the connection schema.",
    inputSchema: s.object(
      "perform custom data session action. Custom resource fields are defined by the connection schema.",
      { connectionId: id, resourceId: id, sessionId: id, action: s.stringEnum(["complete", "cancel"]) },
      { required: ["connectionId", "resourceId", "sessionId", "action"] },
    ),
    outputSchema: s.unknown("The custom data operation response."),
  },
  {
    name: "update_custom_data_record",
    description: "update custom data record. Custom resource fields are defined by the connection schema.",
    inputSchema: s.object(
      "update custom data record. Custom resource fields are defined by the connection schema.",
      {
        connectionId: id,
        resourceId: id,
        recordId: id,
        data: s.looseObject("A record matching the custom resource schema configured in Drata."),
      },
      { required: ["connectionId", "resourceId", "recordId", "data"] },
    ),
    outputSchema: s.unknown("The custom data operation response."),
  },
  {
    name: "delete_custom_data_record",
    description: "delete custom data record. Custom resource fields are defined by the connection schema.",
    inputSchema: s.object(
      "delete custom data record. Custom resource fields are defined by the connection schema.",
      { connectionId: id, resourceId: id, recordId: id },
      { required: ["connectionId", "resourceId", "recordId"] },
    ),
    outputSchema: s.unknown("The custom data operation response."),
  },
].map((action) => defineProviderAction("drata", action));
