import type { JsonSchema } from "../../core/types.ts";
interface DrataListSchemas {
  cursor: JsonSchema;
  size: JsonSchema;
  sort: JsonSchema;
  sortDir: JsonSchema;
  includeTotalCount: JsonSchema;
  expand: JsonSchema;
  fetchAll: JsonSchema;
  maxResults: JsonSchema;
}
import { s } from "../../core/json-schema.ts";

export const drataIdentifier: JsonSchema = s.anyOf([
  s.positiveInteger("The numeric Drata ID."),
  s.nonEmptyString("The Drata resource identifier."),
]);
export const drataWorkspaceId: JsonSchema = s.positiveInteger("The workspace ID returned by list_workspaces.");
export const drataPageProperties: DrataListSchemas = {
  cursor: s.string("The opaque cursor from the preceding response."),
  size: s.integer("The requested page size.", { minimum: 1, maximum: 500, default: 100 }),
  sort: s.string("The field to sort by."),
  sortDir: s.stringEnum(["ASC", "DESC"]),
  includeTotalCount: s.boolean("Request the upstream total count."),
  expand: s.array("Related fields to expand.", s.string()),
  fetchAll: s.boolean("Follow cursor pages up to maxResults."),
  maxResults: s.integer("The record budget when following pages.", { minimum: 1, maximum: 10000, default: 1000 }),
};
export const drataPageOutput: JsonSchema = s.looseRequiredObject(
  "A bounded page or collection with the upstream continuation cursor. A null total means the full query size is unknown.",
  {
    total: s.nullableInteger("The full query total, when known."),
    returned: s.integer(),
    pagination: s.looseObject("The cursor and optional total count returned by Drata."),
    data: s.array(s.looseObject("A Drata resource.")),
  },
);
export const drataRecordOutput: JsonSchema = s.looseObject("The resource returned by Drata.");
