import type { ActionDefinition } from "../../core/types.ts";

import { s } from "../../core/json-schema.ts";
import { defineProviderAction } from "../../core/provider-definition.ts";
import { drataIdentifier as id, drataPageOutput, drataPageProperties, drataRecordOutput } from "./action-schemas.ts";

const policyId = id;
const policyVersionId = id;
const policyInput = s.requiredObject("The policy.", { policyId });
const versionInput = s.object(
  "The policy version.",
  { policyId, policyVersionId, expand: drataPageProperties.expand },
  { required: ["policyId", "policyVersionId"] },
);

export const drataPolicyActions: ActionDefinition[] = [
  {
    name: "list_policies_v2",
    description: "Read policies through the current policy API.",
    inputSchema: s.object("The policy query.", {
      ...drataPageProperties,
      name: s.string(),
      statuses: s.array(s.string()),
      owners: s.array(id),
    }),
    outputSchema: drataPageOutput,
  },
  {
    name: "get_policy",
    description: "Read a policy and its expanded relationships.",
    inputSchema: s.object(
      "The policy lookup.",
      { policyId, expand: drataPageProperties.expand },
      { required: ["policyId"] },
    ),
    outputSchema: drataRecordOutput,
  },
  {
    name: "get_policy_approval_configuration",
    description: "Read the approval rules configured for a policy.",
    inputSchema: policyInput,
    outputSchema: drataRecordOutput,
  },
  {
    name: "list_policy_versions",
    description: "Read versions of a policy with publication-state filters.",
    inputSchema: s.object(
      "The policy versions query.",
      { policyId, ...drataPageProperties, version: s.integer(), current: s.boolean(), statuses: s.array(s.string()) },
      { required: ["policyId"] },
    ),
    outputSchema: drataPageOutput,
  },
  {
    name: "get_policy_version",
    description: "Read one policy version and its publication state.",
    inputSchema: versionInput,
    outputSchema: drataRecordOutput,
  },
  {
    name: "get_policy_version_content",
    description:
      "Read a policy version's HTML and identifying metadata. Check its publication state before treating draft content as active company policy.",
    inputSchema: versionInput,
    outputSchema: s.requiredObject("The policy version content and metadata.", {
      policyId: id,
      policyVersionId: id,
      metadata: s.nullable(drataRecordOutput),
      metadataError: s.nullableString("Why metadata could not be read, if applicable."),
      content: s.string(),
      contentType: s.nullableString("The upstream content type."),
    }),
  },
  {
    name: "list_policy_actions",
    description: "Read the actions currently available for a policy.",
    inputSchema: s.object(
      "The policy actions query.",
      { policyId, ...drataPageProperties },
      { required: ["policyId"] },
    ),
    outputSchema: drataPageOutput,
  },
  {
    name: "perform_policy_action",
    description:
      "Submit, approve, publish, discard or request changes to a policy. Publication and override approval require explicit authorization.",
    inputSchema: s.object(
      "The policy workflow action.",
      {
        policyId,
        action: s.stringEnum([
          "SubmitForApproval",
          "Approve",
          "RequestChanges",
          "OverrideApprove",
          "Publish",
          "Discard",
        ]),
        reason: s.string(),
        overrideReason: s.string(),
      },
      { required: ["policyId", "action"] },
    ),
    outputSchema: drataRecordOutput,
  },
  {
    name: "list_user_assigned_policies",
    description:
      "Read policies assigned to a user, including current-policy metadata so stale acknowledgments can be identified.",
    inputSchema: s.object(
      "The policy assignment query.",
      { userId: id, ...drataPageProperties },
      { required: ["userId"] },
    ),
    outputSchema: drataPageOutput,
  },
  {
    name: "acknowledge_assigned_policy",
    description: "Record a user's authorized acknowledgment of an assigned policy.",
    inputSchema: s.object(
      "The policy acknowledgment.",
      { userId: id, policyId, acceptedAt: s.dateTime("The acknowledgment timestamp."), details: s.string() },
      { required: ["userId", "policyId", "acceptedAt"] },
    ),
    outputSchema: drataRecordOutput,
  },
].map((action) => defineProviderAction("drata", action));
