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

const controlProperties = { workspaceId, controlId: id };
const controlFields = {
  name: s.nonEmptyString("The control name.", { maxLength: 191 }),
  description: s.string("The control description.", { maxLength: 30000 }),
  question: s.string("The control question.", { maxLength: 768 }),
  code: s.string("The control code.", { minLength: 1, maxLength: 20 }),
  activity: s.string("The control activity.", { maxLength: 768 }),
};
const note = s.string("The note text.", { minLength: 1, maxLength: 768 });

export const drataControlActions: ActionDefinition[] = [
  {
    name: "create_control",
    description: "Create a control in the selected workspace.",
    inputSchema: s.object(
      "The new control.",
      { workspaceId, ...controlFields },
      { required: ["workspaceId", "name", "description", "code"] },
    ),
    outputSchema: drataRecordOutput,
  },
  {
    name: "modify_control",
    description: "Change a workspace control's details.",
    inputSchema: s.object(
      "The control changes.",
      { ...controlProperties, ...controlFields },
      { required: ["workspaceId", "controlId"] },
    ),
    outputSchema: drataRecordOutput,
  },
  {
    name: "add_control_owner",
    description: "Assign a user as a control owner.",
    inputSchema: s.requiredObject("The owner assignment.", { ...controlProperties, userId: id }),
    outputSchema: drataRecordOutput,
  },
  {
    name: "modify_control_owners",
    description: "Replace all owners assigned to a control.",
    inputSchema: s.requiredObject("The replacement owners.", { ...controlProperties, userIds: s.array(id) }),
    outputSchema: drataRecordOutput,
  },
  {
    name: "remove_control_owner",
    description: "Remove an owner from a control.",
    inputSchema: s.requiredObject("The owner to remove.", { ...controlProperties, ownerId: id }),
    outputSchema: s.unknown("The removal response."),
  },
  {
    name: "list_control_owners",
    description: "Read the owners assigned to a control.",
    inputSchema: s.object(
      "The control owner query.",
      { ...controlProperties, ...drataPageProperties },
      { required: ["workspaceId", "controlId"] },
    ),
    outputSchema: drataPageOutput,
  },
  {
    name: "create_control_note",
    description: "Add a note to a workspace control.",
    inputSchema: s.requiredObject("The control note.", { ...controlProperties, comment: note }),
    outputSchema: drataRecordOutput,
  },
  {
    name: "update_control_note",
    description: "Replace a control note's text.",
    inputSchema: s.requiredObject("The note changes.", { ...controlProperties, noteId: id, comment: note }),
    outputSchema: drataRecordOutput,
  },
  {
    name: "delete_control_note",
    description: "Delete a control note.",
    inputSchema: s.requiredObject("The note to delete.", { ...controlProperties, noteId: id }),
    outputSchema: s.unknown("The deletion response."),
  },
  {
    name: "list_control_notes",
    description: "Read notes attached to a workspace control.",
    inputSchema: s.object(
      "The control notes query.",
      { ...controlProperties, ...drataPageProperties },
      { required: ["workspaceId", "controlId"] },
    ),
    outputSchema: drataPageOutput,
  },
  {
    name: "list_control_mapped_requirements",
    description: "Read framework requirements mapped to a control.",
    inputSchema: s.object(
      "The control requirements query.",
      { ...controlProperties, ...drataPageProperties },
      { required: ["workspaceId", "controlId"] },
    ),
    outputSchema: drataPageOutput,
  },
].map((action) => defineProviderAction("drata", action));
