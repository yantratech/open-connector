import type { ProviderActionHandlerSubset, ProviderRuntimeHandler } from "../provider-runtime.ts";
import type { DrataActionContext } from "./runtime-request.ts";

import { compactObject, looseArray, optionalInteger, optionalRecord, requiredRecord } from "../../core/cast.ts";
import { providerInputError, requiredInputString } from "../provider-runtime.ts";
import { drataPathId, drataQuery, readDrataList, requestDrataJson } from "./runtime-request.ts";

const riskFilterFields = [
  "riskId",
  "title",
  "description",
  "status",
  "treatment",
  "minInherentScore",
  "maxInherentScore",
  "minResidualScore",
  "maxResidualScore",
  "vendorId",
];

export const drataRiskHandlers: ProviderActionHandlerSubset<"drata", ProviderRuntimeHandler<DrataActionContext>> = {
  create_risk_register(input, context) {
    return requestDrataJson({
      ...context,
      path: "/risk-registers",
      method: "POST",
      body: { name: requiredInputString(input.name, "name"), description: input.description },
      mode: "execute",
    });
  },
  update_risk_register(input, context) {
    const body = compactObject({ name: input.name, description: input.description });
    if (!Object.keys(body).length) throw providerInputError("Provide a register name or description to change.");
    return requestDrataJson({ ...context, path: registerPath(input), method: "PUT", body, mode: "execute" });
  },
  async list_risks(input, context) {
    const result = await readDrataList(context, `${registerPath(input)}/risks`, input, riskFilterFields);
    if (input.includeArchived === true || input.status !== undefined) return result;
    const rows = looseArray(result.data);
    const kept = rows.filter((item) => optionalRecord(item)?.status !== "ARCHIVED");
    const complete = !optionalRecord(result.pagination)?.cursor && !input.cursor;
    let archivedRisksExcluded: number | null = complete ? rows.length - kept.length : null;
    if (!complete) {
      try {
        const archived = await readDrataList(
          context,
          `${registerPath(input)}/risks`,
          {
            ...input,
            cursor: undefined,
            fetchAll: false,
            size: 1,
            includeTotalCount: true,
            status: "ARCHIVED",
            expand: undefined,
          },
          riskFilterFields,
        );
        archivedRisksExcluded = optionalInteger(archived.total) ?? null;
      } catch (error) {
        if (context.signal?.aborted) throw error;
      }
    }
    const upstreamTotal = optionalInteger(result.total);
    return {
      ...result,
      total: complete
        ? kept.length
        : upstreamTotal !== undefined && archivedRisksExcluded !== null
          ? Math.max(0, upstreamTotal - archivedRisksExcluded)
          : null,
      returned: kept.length,
      archivedRisksExcluded,
      data: kept,
    };
  },
  get_risk(input, context) {
    return requestDrataJson({
      ...context,
      path: riskPath(input),
      query: drataQuery(input, ["expand"]),
      mode: "execute",
    });
  },
  create_risk(input, context) {
    return requestDrataJson({
      ...context,
      path: `${registerPath(input)}/risks`,
      method: "POST",
      body: riskBody(input),
      mode: "execute",
    });
  },
  update_risk(input, context) {
    return requestDrataJson({
      ...context,
      path: riskPath(input),
      method: "PUT",
      body: riskBody(input),
      mode: "execute",
    });
  },
  get_risk_insights(input, context) {
    return requestDrataJson({
      ...context,
      path: `${registerPath(input)}/insights`,
      query: drataQuery(input, ["expand"]),
      mode: "execute",
    });
  },
  create_risk_note(input, context) {
    return requestDrataJson({
      ...context,
      path: `${riskPath(input)}/notes`,
      method: "POST",
      body: { comment: requiredInputString(input.comment, "comment") },
      mode: "execute",
    });
  },
  update_risk_note(input, context) {
    return requestDrataJson({
      ...context,
      path: `${riskPath(input)}/notes/${drataPathId(input.noteId, "noteId")}`,
      method: "PUT",
      body: { comment: requiredInputString(input.comment, "comment") },
      mode: "execute",
    });
  },
  list_risk_notes(input, context) {
    return readDrataList(context, `${riskPath(input)}/notes`, input);
  },
};

function registerPath(input: Record<string, unknown>): string {
  return `/risk-registers/${drataPathId(input.riskRegisterId, "riskRegisterId")}`;
}
function riskPath(input: Record<string, unknown>): string {
  return `${registerPath(input)}/risks/${drataPathId(input.riskId, "riskId")}`;
}

function riskBody(input: Record<string, unknown>): Record<string, unknown> {
  const body = requiredRecord(input.body, "body", providerInputError);
  if (!Object.keys(body).length) throw providerInputError("Provide at least one risk field.");
  if (
    body.treatmentPlan === "UNTREATED" &&
    [
      "treatmentDetails",
      "anticipatedCompletionDate",
      "completionDate",
      "residualImpact",
      "residualLikelihood",
      "reviewers",
    ].some((key) => body[key] !== undefined)
  )
    throw providerInputError(
      "Treatment details, residual scores and reviewers require a treatment plan other than UNTREATED.",
    );
  return body;
}
