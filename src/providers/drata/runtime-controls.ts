import type { ProviderActionHandlerSubset, ProviderRuntimeHandler } from "../provider-runtime.ts";
import type { DrataActionContext } from "./runtime-request.ts";

import { compactObject } from "../../core/cast.ts";
import { providerInputError, requiredInputString } from "../provider-runtime.ts";
import { drataPathId, drataWorkspacePath, readDrataList, requestDrataJson } from "./runtime-request.ts";

export const drataControlHandlers: ProviderActionHandlerSubset<"drata", ProviderRuntimeHandler<DrataActionContext>> = {
  create_control(input, context) {
    return requestDrataJson({
      ...context,
      path: `${drataWorkspacePath(input)}/controls`,
      method: "POST",
      body: createControlForm(input),
      mode: "execute",
    });
  },
  modify_control(input, context) {
    return requestDrataJson({
      ...context,
      path: controlPath(input),
      method: "PUT",
      body: controlBody(input),
      mode: "execute",
    });
  },
  add_control_owner(input, context) {
    return requestDrataJson({
      ...context,
      path: `${controlPath(input)}/owners`,
      method: "POST",
      body: { ownerId: input.userId },
      mode: "execute",
    });
  },
  modify_control_owners(input, context) {
    return requestDrataJson({
      ...context,
      path: `${controlPath(input)}/owners`,
      method: "PUT",
      body: { ownerUserIds: input.userIds },
      mode: "execute",
    });
  },
  remove_control_owner(input, context) {
    return requestDrataJson({
      ...context,
      path: `${controlPath(input)}/owners/${drataPathId(input.ownerId, "ownerId")}`,
      method: "DELETE",
      mode: "execute",
    });
  },
  list_control_owners(input, context) {
    return readDrataList(context, `${controlPath(input)}/owners`, input);
  },
  create_control_note(input, context) {
    return requestDrataJson({
      ...context,
      path: `${controlPath(input)}/notes`,
      method: "POST",
      body: { comment: requiredInputString(input.comment, "comment") },
      mode: "execute",
    });
  },
  update_control_note(input, context) {
    return requestDrataJson({
      ...context,
      path: `${controlPath(input)}/notes/${drataPathId(input.noteId, "noteId")}`,
      method: "PUT",
      body: { comment: requiredInputString(input.comment, "comment") },
      mode: "execute",
    });
  },
  delete_control_note(input, context) {
    return requestDrataJson({
      ...context,
      path: `${controlPath(input)}/notes/${drataPathId(input.noteId, "noteId")}`,
      method: "DELETE",
      mode: "execute",
    });
  },
  list_control_notes(input, context) {
    return readDrataList(context, `${controlPath(input)}/notes`, input);
  },
  list_control_mapped_requirements(input, context) {
    return readDrataList(context, `${controlPath(input)}/requirements`, input);
  },
};

function controlPath(input: Record<string, unknown>): string {
  return `${drataWorkspacePath(input)}/controls/${drataPathId(input.controlId, "controlId")}`;
}
function controlBody(input: Record<string, unknown>): Record<string, unknown> {
  const body = compactObject({
    name: input.name,
    description: input.description,
    question: input.question,
    code: input.code,
    activity: input.activity,
  });
  if (!Object.keys(body).length) throw providerInputError("Provide at least one control field.");
  return body;
}

function createControlForm(input: Record<string, unknown>): FormData {
  const fields = controlBody(input);
  for (const key of ["name", "description", "code"]) requiredInputString(fields[key], key);
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) form.set(key, String(value));
  return form;
}
