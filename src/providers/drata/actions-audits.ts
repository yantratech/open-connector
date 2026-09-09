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

const taskFilters = {
  status: s.string("The task status."),
  taskType: s.string("The task type."),
  createdById: id,
  controlId: id,
  title: s.string(),
  description: s.string(),
  dueDateFrom: s.date("The task due date boundary."),
  dueDateTo: s.date("The task due date boundary."),
  assigneeId: id,
};
const taskFields = {
  title: s.nonEmptyString("The task title.", { maxLength: 255 }),
  description: s.nullable(s.string({ maxLength: 768 })),
  dueDate: s.date("The task due date."),
  assigneeId: s.nullable(id),
  controlIds: s.array(id, { uniqueItems: true }),
  riskIds: s.array(id, { uniqueItems: true }),
  policyIds: s.array(id, { uniqueItems: true }),
};
const auditProperties = { workspaceId, auditId: id };

export const drataAuditActions: ActionDefinition[] = [
  {
    name: "list_tasks",
    description: "Read tasks in a workspace.",
    inputSchema: s.object(
      "The task query.",
      { workspaceId, ...drataPageProperties, ...taskFilters },
      { required: ["workspaceId"] },
    ),
    outputSchema: drataPageOutput,
  },
  {
    name: "list_upcoming_tasks",
    description: "Read upcoming workspace tasks, including account-level renewal tasks.",
    inputSchema: s.object(
      "The upcoming tasks query.",
      { workspaceId, ...drataPageProperties, ...taskFilters },
      { required: ["workspaceId"] },
    ),
    outputSchema: drataPageOutput,
  },
  {
    name: "get_task",
    description: "Read one workspace task.",
    inputSchema: s.object(
      "The task lookup.",
      { workspaceId, taskId: id, expand: drataPageProperties.expand },
      { required: ["workspaceId", "taskId"] },
    ),
    outputSchema: drataRecordOutput,
  },
  {
    name: "create_task",
    description: "Create a workspace task.",
    inputSchema: s.requiredObject("The new task.", {
      workspaceId,
      body: s.object(
        "The new task fields.",
        {
          ...taskFields,
          description: s.string({ maxLength: 768 }),
          assigneeId: id,
          taskType: s.stringEnum([
            "POLICY_RENEWALS",
            "EVIDENCE",
            "VENDOR",
            "EXTERNAL_EVIDENCE",
            "REPORT",
            "GENERAL",
            "CONTROL",
            "RISK",
            "CONTROL_APPROVALS",
            "POLICY_APPROVALS",
          ]),
        },
        { required: ["title", "dueDate"] },
      ),
    }),
    outputSchema: drataRecordOutput,
  },
  {
    name: "update_task",
    description: "Update a workspace task's details.",
    inputSchema: s.requiredObject("The task changes.", {
      workspaceId,
      taskId: id,
      body: s.requireAnyProperty(
        s.object(
          "The task fields to change. Link arrays replace their existing collection; null clears description or assignee.",
          taskFields,
        ),
        ["title", "description", "dueDate", "assigneeId", "controlIds", "riskIds", "policyIds"],
      ),
    }),
    outputSchema: drataRecordOutput,
  },
  {
    name: "perform_task_action",
    description: "Mark a task complete or incomplete.",
    inputSchema: s.requiredObject("The task state change.", {
      workspaceId,
      taskId: id,
      action: s.stringEnum(["complete", "uncomplete"]),
    }),
    outputSchema: drataRecordOutput,
  },
  {
    name: "list_audits",
    description: "Read the audits available in a workspace.",
    inputSchema: s.object("The audit query.", { workspaceId, ...drataPageProperties }, { required: ["workspaceId"] }),
    outputSchema: drataPageOutput,
  },
  {
    name: "get_audit",
    description: "Read one workspace audit.",
    inputSchema: s.object(
      "The audit lookup.",
      { ...auditProperties, expand: drataPageProperties.expand },
      { required: ["workspaceId", "auditId"] },
    ),
    outputSchema: drataRecordOutput,
  },
  {
    name: "list_audit_requests",
    description: "Read requests made by an auditor, with status and user filters.",
    inputSchema: s.object(
      "The audit requests query.",
      {
        ...auditProperties,
        ...drataPageProperties,
        statuses: s.array(s.string()),
        status: s.string(),
        userIds: s.array(id),
      },
      { required: ["workspaceId", "auditId"] },
    ),
    outputSchema: drataPageOutput,
  },
  {
    name: "get_audit_request",
    description: "Read one auditor request.",
    inputSchema: s.object(
      "The audit request lookup.",
      { ...auditProperties, requestId: id, expand: drataPageProperties.expand },
      { required: ["workspaceId", "auditId", "requestId"] },
    ),
    outputSchema: drataRecordOutput,
  },
].map((action) => defineProviderAction("drata", action));
