import type { ActionDefinition } from "../../core/types.ts";

import { s } from "../../core/json-schema.ts";
import { defineProviderAction } from "../../core/provider-definition.ts";

export const xeroProjectActions: ActionDefinition[] = [
  {
    name: "list_projects",
    description: "List projects. Uses the selected organisation and preserves Xero response metadata.",
    requiredScopes: ["projects.read"],
    inputSchema: s.object(
      {
        tenant_id: s.uuid("The connected organisation ID."),
        project_ids: s.array(s.uuid("project_ids item")),
        contact_id: s.uuid("contact_id"),
        states: s.string("states", {}),
        page: s.integer({ minimum: 1, default: 1 }),
        page_size: s.integer({ minimum: 1, maximum: 500, default: 50 }),
      },
      { required: [] },
    ),
    outputSchema: s.looseObject(
      "The Xero response, including provider validation details and pagination when returned.",
    ),
  },
  {
    name: "get_project",
    description: "Get project. Uses the selected organisation and preserves Xero response metadata.",
    requiredScopes: ["projects.read"],
    inputSchema: s.object(
      { tenant_id: s.uuid("The connected organisation ID."), project_id: s.uuid("project_id") },
      { required: ["project_id"] },
    ),
    outputSchema: s.looseObject(
      "The Xero response, including provider validation details and pagination when returned.",
    ),
  },
  {
    name: "create_project",
    description: "Create project. Uses the selected organisation and preserves Xero response metadata.",
    requiredScopes: ["projects"],
    inputSchema: s.object(
      {
        tenant_id: s.uuid("The connected organisation ID."),
        idempotency_key: s.string({ minLength: 1, maxLength: 128 }),
        contact_id: s.uuid("contact_id"),
        name: s.string("name", { minLength: 1 }),
        estimate_amount: s.number({}),
        deadline_utc: s.dateTime("deadline_utc"),
      },
      { required: ["name"] },
    ),
    outputSchema: s.looseObject(
      "The Xero response, including provider validation details and pagination when returned.",
    ),
  },
  {
    name: "update_project",
    description: "Update project. Replaces the documented writable fields; omitted optional fields may be cleared.",
    requiredScopes: ["projects"],
    inputSchema: s.object(
      {
        tenant_id: s.uuid("The connected organisation ID."),
        idempotency_key: s.string({ minLength: 1, maxLength: 128 }),
        project_id: s.uuid("project_id"),
        contact_id: s.uuid("contact_id"),
        name: s.string("name", { minLength: 1 }),
        estimate_amount: s.number({}),
        deadline_utc: s.dateTime("deadline_utc"),
      },
      { required: ["project_id", "name"] },
    ),
    outputSchema: s.looseObject(
      "The Xero response, including provider validation details and pagination when returned.",
    ),
  },
  {
    name: "list_project_users",
    description: "List project users. Uses the selected organisation and preserves Xero response metadata.",
    requiredScopes: ["projects.read"],
    inputSchema: s.object(
      {
        tenant_id: s.uuid("The connected organisation ID."),
        page: s.integer({ minimum: 1, default: 1 }),
        page_size: s.integer({ minimum: 1, maximum: 500, default: 50 }),
      },
      { required: [] },
    ),
    outputSchema: s.looseObject(
      "The Xero response, including provider validation details and pagination when returned.",
    ),
  },
  {
    name: "list_project_tasks",
    description: "List project tasks. Uses the selected organisation and preserves Xero response metadata.",
    requiredScopes: ["projects.read"],
    inputSchema: s.object(
      {
        tenant_id: s.uuid("The connected organisation ID."),
        project_id: s.uuid("project_id"),
        page: s.integer({ minimum: 1 }),
        page_size: s.integer({ minimum: 1, maximum: 500, default: 50 }),
        task_ids: s.string("task_ids", {}),
        charge_type: s.stringEnum(["TIME", "FIXED", "NON_CHARGEABLE"]),
      },
      { required: ["project_id"] },
    ),
    outputSchema: s.looseObject(
      "The Xero response, including provider validation details and pagination when returned.",
    ),
  },
  {
    name: "get_project_task",
    description: "Get project task. Uses the selected organisation and preserves Xero response metadata.",
    requiredScopes: ["projects.read"],
    inputSchema: s.object(
      {
        tenant_id: s.uuid("The connected organisation ID."),
        project_id: s.uuid("project_id"),
        task_id: s.uuid("task_id"),
      },
      { required: ["project_id", "task_id"] },
    ),
    outputSchema: s.looseObject(
      "The Xero response, including provider validation details and pagination when returned.",
    ),
  },
  {
    name: "create_project_task",
    description: "Create project task. Uses the selected organisation and preserves Xero response metadata.",
    requiredScopes: ["projects"],
    inputSchema: s.object(
      {
        tenant_id: s.uuid("The connected organisation ID."),
        idempotency_key: s.string({ minLength: 1, maxLength: 128 }),
        project_id: s.uuid("project_id"),
        name: s.string("name", { minLength: 1, maxLength: 100 }),
        rate: s.requiredObject("Task rate in its currency.", {
          currency: s.string({ pattern: "^[A-Z]{3}$" }),
          value: s.number({ minimum: 0 }),
        }),
        charge_type: s.stringEnum(["TIME", "FIXED", "NON_CHARGEABLE"]),
        estimate_minutes: s.integer({}),
      },
      { required: ["project_id", "name", "rate", "charge_type"] },
    ),
    outputSchema: s.looseObject(
      "The Xero response, including provider validation details and pagination when returned.",
    ),
  },
  {
    name: "update_project_task",
    description:
      "Update project task. Replaces the documented writable fields; omitted optional fields may be cleared.",
    requiredScopes: ["projects"],
    inputSchema: s.object(
      {
        tenant_id: s.uuid("The connected organisation ID."),
        idempotency_key: s.string({ minLength: 1, maxLength: 128 }),
        project_id: s.uuid("project_id"),
        task_id: s.uuid("task_id"),
        name: s.string("name", { minLength: 1, maxLength: 100 }),
        rate: s.requiredObject("Task rate in its currency.", {
          currency: s.string({ pattern: "^[A-Z]{3}$" }),
          value: s.number({ minimum: 0 }),
        }),
        charge_type: s.stringEnum(["TIME", "FIXED", "NON_CHARGEABLE"]),
        estimate_minutes: s.integer({}),
      },
      { required: ["project_id", "task_id", "name", "rate", "charge_type"] },
    ),
    outputSchema: s.looseObject(
      "The Xero response, including provider validation details and pagination when returned.",
    ),
  },
  {
    name: "delete_project_task",
    description: "Delete project task. Permanently removes this project record.",
    requiredScopes: ["projects"],
    inputSchema: s.object(
      {
        tenant_id: s.uuid("The connected organisation ID."),
        project_id: s.uuid("project_id"),
        task_id: s.uuid("task_id"),
      },
      { required: ["project_id", "task_id"] },
    ),
    outputSchema: s.looseObject(
      "The Xero response, including provider validation details and pagination when returned.",
    ),
  },
  {
    name: "list_time_entries",
    description: "List time entries. Uses the selected organisation and preserves Xero response metadata.",
    requiredScopes: ["projects.read"],
    inputSchema: s.object(
      {
        tenant_id: s.uuid("The connected organisation ID."),
        project_id: s.uuid("project_id"),
        user_id: s.uuid("user_id"),
        task_id: s.uuid("task_id"),
        invoice_id: s.uuid("invoice_id"),
        contact_id: s.uuid("contact_id"),
        page: s.integer({ minimum: 1 }),
        page_size: s.integer({ minimum: 1, maximum: 500, default: 50 }),
        states: s.array(s.string("states item", {})),
        is_chargeable: s.boolean({}),
        date_after_utc: s.dateTime("date_after_utc"),
        date_before_utc: s.dateTime("date_before_utc"),
      },
      { required: ["project_id"] },
    ),
    outputSchema: s.looseObject(
      "The Xero response, including provider validation details and pagination when returned.",
    ),
  },
  {
    name: "get_time_entry",
    description: "Get time entry. Uses the selected organisation and preserves Xero response metadata.",
    requiredScopes: ["projects.read"],
    inputSchema: s.object(
      {
        tenant_id: s.uuid("The connected organisation ID."),
        project_id: s.uuid("project_id"),
        time_entry_id: s.uuid("time_entry_id"),
      },
      { required: ["project_id", "time_entry_id"] },
    ),
    outputSchema: s.looseObject(
      "The Xero response, including provider validation details and pagination when returned.",
    ),
  },
  {
    name: "create_time_entry",
    description: "Create time entry. Uses the selected organisation and preserves Xero response metadata.",
    requiredScopes: ["projects"],
    inputSchema: s.object(
      {
        tenant_id: s.uuid("The connected organisation ID."),
        idempotency_key: s.string({ minLength: 1, maxLength: 128 }),
        project_id: s.uuid("project_id"),
        user_id: s.uuid("user_id"),
        task_id: s.uuid("task_id"),
        date_utc: s.dateTime("date_utc"),
        duration: s.integer({ minimum: 1, maximum: 59940 }),
        description: s.string("description", {}),
      },
      { required: ["project_id", "user_id", "task_id", "date_utc", "duration"] },
    ),
    outputSchema: s.looseObject(
      "The Xero response, including provider validation details and pagination when returned.",
    ),
  },
  {
    name: "update_time_entry",
    description: "Update time entry. Replaces the documented writable fields; omitted optional fields may be cleared.",
    requiredScopes: ["projects"],
    inputSchema: s.object(
      {
        tenant_id: s.uuid("The connected organisation ID."),
        idempotency_key: s.string({ minLength: 1, maxLength: 128 }),
        project_id: s.uuid("project_id"),
        time_entry_id: s.uuid("time_entry_id"),
        user_id: s.uuid("user_id"),
        task_id: s.uuid("task_id"),
        date_utc: s.dateTime("date_utc"),
        duration: s.integer({ minimum: 1, maximum: 59940 }),
        description: s.string("description", {}),
      },
      { required: ["project_id", "time_entry_id", "user_id", "task_id", "date_utc", "duration"] },
    ),
    outputSchema: s.looseObject(
      "The Xero response, including provider validation details and pagination when returned.",
    ),
  },
  {
    name: "delete_time_entry",
    description: "Delete time entry. Permanently removes this project record.",
    requiredScopes: ["projects"],
    inputSchema: s.object(
      {
        tenant_id: s.uuid("The connected organisation ID."),
        project_id: s.uuid("project_id"),
        time_entry_id: s.uuid("time_entry_id"),
      },
      { required: ["project_id", "time_entry_id"] },
    ),
    outputSchema: s.looseObject(
      "The Xero response, including provider validation details and pagination when returned.",
    ),
  },
].map((action) => defineProviderAction("xero", action));
