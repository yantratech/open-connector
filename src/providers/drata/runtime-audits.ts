import type { ProviderActionHandlerSubset, ProviderRuntimeHandler } from "../provider-runtime.ts";
import type { DrataActionContext } from "./runtime-request.ts";

import { requiredRecord } from "../../core/cast.ts";
import { providerInputError } from "../provider-runtime.ts";
import { drataPathId, drataQuery, drataWorkspacePath, readDrataList, requestDrataJson } from "./runtime-request.ts";

const taskFilterFields = [
  "status",
  "taskType",
  "createdById",
  "controlId",
  "title",
  "description",
  "dueDateFrom",
  "dueDateTo",
  "assigneeId",
];

export const drataAuditHandlers: ProviderActionHandlerSubset<"drata", ProviderRuntimeHandler<DrataActionContext>> = {
  list_tasks(input, context) {
    return readDrataList(context, `${drataWorkspacePath(input)}/tasks`, input, taskFilterFields);
  },
  list_upcoming_tasks(input, context) {
    return readDrataList(context, `${drataWorkspacePath(input)}/upcoming-tasks`, input, taskFilterFields);
  },
  get_task(input, context) {
    return requestDrataJson({
      ...context,
      path: taskPath(input),
      query: drataQuery(input, ["expand"]),
      mode: "execute",
    });
  },
  create_task(input, context) {
    return requestDrataJson({
      ...context,
      path: `${drataWorkspacePath(input)}/tasks`,
      method: "POST",
      body: taskBody(input),
      mode: "execute",
    });
  },
  update_task(input, context) {
    return requestDrataJson({
      ...context,
      path: taskPath(input),
      method: "PUT",
      body: taskBody(input),
      mode: "execute",
    });
  },
  perform_task_action(input, context) {
    return requestDrataJson({
      ...context,
      path: `${taskPath(input)}/actions`,
      method: "POST",
      body: { action: input.action },
      mode: "execute",
    });
  },
  list_audits(input, context) {
    return readDrataList(context, `${drataWorkspacePath(input)}/audits`, input);
  },
  get_audit(input, context) {
    return requestDrataJson({
      ...context,
      path: auditPath(input),
      query: drataQuery(input, ["expand"]),
      mode: "execute",
    });
  },
  list_audit_requests(input, context) {
    return readDrataList(
      context,
      `${auditPath(input)}/requests`,
      {
        ...input,
        statuses: undefined,
        status: input.statuses ?? (input.status === undefined ? undefined : [input.status]),
      },
      ["status", "userIds"],
    );
  },
  get_audit_request(input, context) {
    return requestDrataJson({
      ...context,
      path: `${auditPath(input)}/requests/${drataPathId(input.requestId, "requestId")}`,
      query: drataQuery(input, ["expand"]),
      mode: "execute",
    });
  },
};

function taskPath(input: Record<string, unknown>): string {
  return `${drataWorkspacePath(input)}/tasks/${drataPathId(input.taskId, "taskId")}`;
}
function auditPath(input: Record<string, unknown>): string {
  return `${drataWorkspacePath(input)}/audits/${drataPathId(input.auditId, "auditId")}`;
}

function taskBody(input: Record<string, unknown>): Record<string, unknown> {
  const body = requiredRecord(input.body, "body", providerInputError);
  if (!Object.keys(body).length) throw providerInputError("Provide at least one task field.");
  return body;
}
