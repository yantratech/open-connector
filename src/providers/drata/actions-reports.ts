import type { ActionDefinition } from "../../core/types.ts";

import { s } from "../../core/json-schema.ts";
import { defineProviderAction } from "../../core/provider-definition.ts";
import { drataIdentifier as id, drataRecordOutput, drataWorkspaceId as workspaceId } from "./action-schemas.ts";

export const drataReportsActions: ActionDefinition[] = [
  {
    name: "check_control_status",
    description:
      "Check control readiness using external evidence, library reports, mapped policies and monitor tests. Archived controls are excluded by default.",
    inputSchema: s.object(
      "Check control readiness using external evidence, library reports, mapped policies and monitor tests. Archived controls are excluded by default.",
      {
        workspaceId,
        frameworkFilter: s.string(),
        includeArchived: s.boolean(),
        includeNonCurrent: s.boolean(),
        filter: s.stringEnum(["all", "not_ready", "no_evidence", "no_owner", "not_monitored", "ready"]),
        codes: s.array(s.string()),
        fields: s.array(s.string()),
      },
      { required: ["workspaceId"] },
    ),
    outputSchema: drataRecordOutput,
  },
  {
    name: "check_monitors",
    description:
      "Summarize monitor status and return a bounded result page. Error is a subset of failing; testing monitors retain their last result.",
    inputSchema: s.object(
      "Summarize monitor status and return a bounded result page. Error is a subset of failing; testing monitors retain their last result.",
      {
        filter: s.stringEnum(["all", "passing", "failing", "disabled", "error", "testing"]),
        page: s.positiveInteger("The result page."),
        size: s.integer({ minimum: 1, maximum: 500 }),
      },
      { required: [] },
    ),
    outputSchema: drataRecordOutput,
  },
  {
    name: "check_personnel_compliance",
    description:
      "Check personnel using Drata's authoritative complianceChecks. Missing checks remain unknown; excluded checks do not count as failures.",
    inputSchema: s.object(
      "Check personnel using Drata's authoritative complianceChecks. Missing checks remain unknown; excluded checks do not count as failures.",
      { includeNonCurrent: s.boolean(), fields: s.array(s.string()) },
      { required: [] },
    ),
    outputSchema: drataRecordOutput,
  },
  {
    name: "check_vendor_risk",
    description:
      "Summarize vendor risk, MFA and completed security reviews. Archived vendors remain marked and review lookup failures remain unknown.",
    inputSchema: s.object(
      "Summarize vendor risk, MFA and completed security reviews. Archived vendors remain marked and review lookup failures remain unknown.",
      { includeReviews: s.boolean() },
      { required: [] },
    ),
    outputSchema: drataRecordOutput,
  },
  {
    name: "list_vendor_security_review_statuses",
    description:
      "Read vendor review posture. Scheduled and in-progress reviews are not counted as completed; inaccessible review data remains unknown.",
    inputSchema: s.object(
      "Read vendor review posture. Scheduled and in-progress reviews are not counted as completed; inaccessible review data remains unknown.",
      { includeReviews: s.boolean() },
      { required: [] },
    ),
    outputSchema: drataRecordOutput,
  },
  {
    name: "get_compliance_summary",
    description:
      "Summarize workspace controls, monitoring, personnel, vendors, policies, devices and connections with explicit completeness metadata.",
    inputSchema: s.object(
      "Summarize workspace controls, monitoring, personnel, vendors, policies, devices and connections with explicit completeness metadata.",
      { workspaceId, frameworkFilter: s.string(), includeArchived: s.boolean(), includeNonCurrent: s.boolean() },
      { required: ["workspaceId"] },
    ),
    outputSchema: drataRecordOutput,
  },
  {
    name: "run_gap_analysis",
    description:
      "Identify control, monitoring, personnel and vendor compliance gaps. Unknown data remains separate from confirmed failures.",
    inputSchema: s.object(
      "Identify control, monitoring, personnel and vendor compliance gaps. Unknown data remains separate from confirmed failures.",
      { workspaceId, frameworkFilter: s.string(), includeArchived: s.boolean(), includeNonCurrent: s.boolean() },
      { required: ["workspaceId"] },
    ),
    outputSchema: drataRecordOutput,
  },
  {
    name: "get_framework_requirement_readiness_rollup",
    description:
      "Compute requirement readiness from all mapped controls, preserving archived scope and cross-checking Drata's reported framework totals.",
    inputSchema: s.object(
      "Compute requirement readiness from all mapped controls, preserving archived scope and cross-checking Drata's reported framework totals.",
      {
        workspaceId,
        frameworkId: id,
        includeControlDetail: s.boolean(),
        page: s.positiveInteger("The detail page."),
        size: s.integer({ minimum: 1, maximum: 500, default: 25 }),
      },
      { required: ["workspaceId"] },
    ),
    outputSchema: drataRecordOutput,
  },
].map((action) => defineProviderAction("drata", action));
