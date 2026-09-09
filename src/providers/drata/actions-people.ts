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

export const drataPeopleActions: ActionDefinition[] = [
  {
    name: "list_personnel_v2",
    description:
      "Read full personnel names, emails and compliance checks from the authoritative personnel directory. V2 ID-only records are enriched from V1.",
    inputSchema: s.object(
      "Read full personnel names, emails and compliance checks from the authoritative personnel directory. V2 ID-only records are enriched from V1.",
      { q: s.string(), fields: s.array(s.string()), ...drataPageProperties },
      { required: [] },
    ),
    outputSchema: drataPageOutput,
  },
  {
    name: "update_personnel",
    description: "Change a person's profile. Select exactly one personnelId or lookupEmail.",
    inputSchema: s.object(
      "Change a person's profile. Select exactly one personnelId or lookupEmail.",
      {
        personnelId: id,
        lookupEmail: s.email("An exact personnel email match."),
        firstName: s.string(),
        lastName: s.string(),
        jobTitle: s.string(),
        email: s.email("The new email."),
      },
      { required: [] },
    ),
    outputSchema: drataRecordOutput,
  },
  {
    name: "create_background_check",
    description:
      "Record a background check from its result URL. Select exactly one userId, personnelId or lookupEmail; personnel IDs are resolved to user IDs.",
    inputSchema: s.object(
      "Record a background check from its result URL. Select exactly one userId, personnelId or lookupEmail; personnel IDs are resolved to user IDs.",
      {
        userId: id,
        personnelId: id,
        lookupEmail: s.email("An exact personnel email match."),
        url: s.url("The background check results URL."),
        filedAt: s.string(),
      },
      { required: ["url"] },
    ),
    outputSchema: drataRecordOutput,
  },
  {
    name: "list_personnel_devices",
    description: "List devices for exactly one personnelId or lookupEmail.",
    inputSchema: s.object(
      "List devices for exactly one personnelId or lookupEmail.",
      {
        personnelId: id,
        lookupEmail: s.email("An exact personnel email match."),
        externalId: s.string(),
        macAddress: s.string(),
        serialNumber: s.string(),
        sourceType: s.string(),
        ...drataPageProperties,
      },
      { required: [] },
    ),
    outputSchema: drataPageOutput,
  },
  {
    name: "list_monitoring_tests_v2",
    description: "Read workspace-scoped testId values and distinct internal monitor IDs.",
    inputSchema: s.object(
      "Read workspace-scoped testId values and distinct internal monitor IDs.",
      { workspaceId, ...drataPageProperties },
      { required: ["workspaceId"] },
    ),
    outputSchema: drataPageOutput,
  },
  {
    name: "list_monitoring_test_failures",
    description: "Read live failures after resolving exactly one testId or monitorId within the workspace.",
    inputSchema: s.object(
      "Read live failures after resolving exactly one testId or monitorId within the workspace.",
      { workspaceId, testId: id, monitorId: id, ...drataPageProperties },
      { required: ["workspaceId"] },
    ),
    outputSchema: drataPageOutput,
  },
  {
    name: "list_events_v2",
    description: "Read the latest activity events with optional date and category filters.",
    inputSchema: s.object(
      "Read the latest activity events with optional date and category filters.",
      { type: s.string(), category: s.string(), createdAtFrom: s.string(), ...drataPageProperties },
      { required: [] },
    ),
    outputSchema: drataPageOutput,
  },
  {
    name: "get_recent_events",
    description: "Read up to 50 recent activity events.",
    inputSchema: s.object(
      "Read up to 50 recent activity events.",
      { limit: s.integer({ minimum: 1, maximum: 50, default: 20 }) },
      { required: [] },
    ),
    outputSchema: drataRecordOutput,
  },
  {
    name: "list_connections",
    description: "List integration connections and their authorization/health metadata.",
    inputSchema: s.object(
      "List integration connections and their authorization/health metadata.",
      { ...drataPageProperties },
      { required: [] },
    ),
    outputSchema: drataPageOutput,
  },
  {
    name: "search_vendors",
    description: "Find vendors by case-insensitive name substring.",
    inputSchema: s.object(
      "Find vendors by case-insensitive name substring.",
      { query: s.nonEmptyString("The vendor name to search for."), ...drataPageProperties },
      { required: ["query"] },
    ),
    outputSchema: drataPageOutput,
  },
].map((action) => defineProviderAction("drata", action));
