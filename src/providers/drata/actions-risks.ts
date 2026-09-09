import type { ActionDefinition } from "../../core/types.ts";

import { s } from "../../core/json-schema.ts";
import { defineProviderAction } from "../../core/provider-definition.ts";
import { drataIdentifier as id, drataPageOutput, drataPageProperties, drataRecordOutput } from "./action-schemas.ts";

const riskRegisterId = s.positiveInteger("The risk register ID.");
const riskProperties = { riskRegisterId, riskId: id };
const riskLinks = s.array(
  s.requiredObject("A linked Drata resource.", { id: s.positiveInteger("The linked resource ID.") }),
);
const riskFields = {
  title: s.nonEmptyString("The risk title.", { maxLength: 191 }),
  description: s.string("The risk scenario.", { maxLength: 768 }),
  identifiedAt: s.nullable(s.string("The date the risk was identified.")),
  impact: s.number({ minimum: 1, maximum: 10 }),
  likelihood: s.number({ minimum: 1, maximum: 10 }),
  treatmentPlan: s.stringEnum(["UNTREATED", "ACCEPT", "TRANSFER", "AVOID", "MITIGATE"]),
  treatmentDetails: s.string({ maxLength: 30000 }),
  anticipatedCompletionDate: s.string("The target treatment date."),
  completionDate: s.string("The actual treatment completion date."),
  residualImpact: s.number({ minimum: 1, maximum: 10 }),
  residualLikelihood: s.number({ minimum: 1, maximum: 10 }),
  status: s.stringEnum(["ACTIVE", "ARCHIVED", "CLOSED"]),
  categories: riskLinks,
  owners: riskLinks,
  reviewers: riskLinks,
  controls: riskLinks,
  customFields: s.array(
    s.requiredObject("A configured custom field value.", {
      customFieldId: s.positiveInteger("The configured field ID."),
      value: s.unknown("The value matching the custom field definition."),
    }),
  ),
};
const riskFilters = {
  title: s.string(),
  status: s.stringEnum(["ACTIVE", "ARCHIVED", "CLOSED"]),
  treatment: s.stringEnum(["UNTREATED", "ACCEPT", "TRANSFER", "AVOID", "MITIGATE"]),
  riskId: id,
  description: s.string(),
  minInherentScore: s.number(),
  maxInherentScore: s.number(),
  minResidualScore: s.number(),
  maxResidualScore: s.number(),
  vendorId: id,
};

export const drataRiskActions: ActionDefinition[] = [
  {
    name: "create_risk_register",
    description: "Create a risk register.",
    inputSchema: s.object(
      "The new register.",
      { name: s.nonEmptyString("The register name."), description: s.string() },
      { required: ["name"] },
    ),
    outputSchema: drataRecordOutput,
  },
  {
    name: "update_risk_register",
    description: "Change a risk register's name or description.",
    inputSchema: s.object(
      "The register changes.",
      { riskRegisterId, name: s.nonEmptyString("The register name."), description: s.string() },
      { required: ["riskRegisterId"] },
    ),
    outputSchema: drataRecordOutput,
  },
  {
    name: "list_risks",
    description:
      "Read risks in a register. Archived risks are excluded unless includeArchived or an explicit status is supplied; unavailable adjusted totals remain null.",
    inputSchema: s.object(
      "The risk query.",
      { riskRegisterId, ...drataPageProperties, ...riskFilters, includeArchived: s.boolean() },
      { required: ["riskRegisterId"] },
    ),
    outputSchema: drataPageOutput,
  },
  {
    name: "get_risk",
    description: "Read a risk by numeric or prefixed identifier.",
    inputSchema: s.object(
      "The risk lookup.",
      { ...riskProperties, expand: drataPageProperties.expand },
      { required: ["riskRegisterId", "riskId"] },
    ),
    outputSchema: drataRecordOutput,
  },
  {
    name: "create_risk",
    description: "Create a risk in a register using Drata's risk fields.",
    inputSchema: s.requiredObject("The risk creation request.", {
      riskRegisterId,
      body: s.object("The new risk fields.", riskFields, { required: ["title", "description"] }),
    }),
    outputSchema: drataRecordOutput,
  },
  {
    name: "update_risk",
    description: "Update a risk's details, scoring or treatment plan.",
    inputSchema: s.requiredObject("The risk update.", {
      ...riskProperties,
      body: s.requireAnyProperty(s.object("The risk fields to change. Omitted fields remain unchanged.", riskFields), [
        "title",
        "description",
        "identifiedAt",
        "impact",
        "likelihood",
        "treatmentPlan",
        "treatmentDetails",
        "anticipatedCompletionDate",
        "completionDate",
        "residualImpact",
        "residualLikelihood",
        "status",
        "categories",
        "owners",
        "reviewers",
        "controls",
        "customFields",
      ]),
    }),
    outputSchema: drataRecordOutput,
  },
  {
    name: "get_risk_insights",
    description: "Read aggregate insights for a risk register.",
    inputSchema: s.object(
      "The register insights query.",
      { riskRegisterId, expand: drataPageProperties.expand },
      { required: ["riskRegisterId"] },
    ),
    outputSchema: drataRecordOutput,
  },
  {
    name: "create_risk_note",
    description: "Add a note to a risk.",
    inputSchema: s.requiredObject("The new risk note.", {
      ...riskProperties,
      comment: s.nonEmptyString("The note text."),
    }),
    outputSchema: drataRecordOutput,
  },
  {
    name: "update_risk_note",
    description: "Replace a risk note's text.",
    inputSchema: s.requiredObject("The risk note changes.", {
      ...riskProperties,
      noteId: id,
      comment: s.nonEmptyString("The note text."),
    }),
    outputSchema: drataRecordOutput,
  },
  {
    name: "list_risk_notes",
    description: "Read notes attached to a risk. An empty subcollection alone does not prove the risk exists.",
    inputSchema: s.object(
      "The risk notes query.",
      { ...riskProperties, ...drataPageProperties },
      { required: ["riskRegisterId", "riskId"] },
    ),
    outputSchema: drataPageOutput,
  },
].map((action) => defineProviderAction("drata", action));
