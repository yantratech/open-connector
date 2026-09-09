import type { ProviderActionHandlerSubset, ProviderRuntimeHandler } from "../provider-runtime.ts";
import type { DrataActionContext } from "./runtime-request.ts";

import { looseArray, optionalInteger, optionalRecord, recordOrEmpty } from "../../core/cast.ts";
import { providerInputError } from "../provider-runtime.ts";
import { readDrataLegacyList } from "./runtime-legacy.ts";
import { personnelRecord } from "./runtime-personnel.ts";
import { drataPathId, drataWorkspacePath, readDrataList } from "./runtime-request.ts";

export const drataComplianceHandlers: ProviderActionHandlerSubset<
  "drata",
  ProviderRuntimeHandler<DrataActionContext>
> = {
  check_control_status(input, context) {
    return checkControls(input, context);
  },
  check_monitors(input, context) {
    return checkMonitors(input, context);
  },
  check_personnel_compliance(input, context) {
    return checkPersonnel(input, context);
  },
  check_vendor_risk(input, context) {
    return checkVendors(input, context);
  },
  list_vendor_security_review_statuses(input, context) {
    return checkVendors(input, context);
  },
  async get_compliance_summary(input, context) {
    const [controls, monitors, personnel, vendors, policies, devices, connections, recentEvents] = await Promise.all([
      checkControls(input, context),
      checkMonitors(input, context),
      checkPersonnel(input, context),
      checkVendors(input, context),
      readDrataLegacyList(context, "/policies", { fetchAll: true }),
      readDrataList(context, "/devices", { size: 1, includeTotalCount: true }),
      readDrataLegacyList(context, "/connections", { fetchAll: true }),
      readDrataLegacyList(context, "/events", { limit: 5, sort: "CREATED", sortDir: "DESC" }),
    ]);
    return {
      workspaceId: input.workspaceId,
      controls: controls.summary,
      monitors: monitors.statusCounts,
      personnel: personnel.summary,
      vendors: vendors.summary,
      policyCount: policies.total ?? policies.data.length,
      deviceCount: devices.total,
      connectionCount: connections.total ?? connections.data.length,
      recentEvents: recentEvents.data,
      complete:
        controls.complete &&
        monitors.complete &&
        personnel.complete &&
        vendors.complete &&
        policies.pagination.nextPage === null &&
        connections.pagination.nextPage === null,
    };
  },
  async run_gap_analysis(input, context) {
    const [controls, monitors, personnel, vendors] = await Promise.all([
      checkControls({ ...input, filter: "not_ready" }, context),
      checkMonitors({ ...input, filter: "failing", page: 1, size: 10000 }, context),
      checkPersonnel(input, context),
      checkVendors(input, context),
    ]);
    const gaps: Record<string, unknown>[] = [];
    for (const row of controls.controls)
      gaps.push({
        priority: !row.hasEvidence ? "HIGH" : "MEDIUM",
        category: "control",
        id: row.id,
        code: row.code,
        name: row.name,
        reason: !row.hasEvidence ? "No evidence source is mapped." : "The control is not ready.",
      });
    for (const row of monitors.monitors)
      gaps.push({
        priority: row.priority ?? "HIGH",
        category: "monitor",
        id: row.id,
        name: row.name,
        reason:
          row.status === "ERROR"
            ? "The monitor could not evaluate the check."
            : "The monitor's latest result is failing.",
      });
    for (const row of personnel.personnel.filter((row) => row.isCompliant === false))
      gaps.push({
        priority: "MEDIUM",
        category: "personnel",
        id: row.id,
        email: row.email,
        failedChecks: row.failedChecks,
        reason: "Drata reports FULL_COMPLIANCE as FAIL.",
      });
    for (const row of vendors.vendors.filter((row) => !row.archived && row.reviewStatus === "NO_COMPLETED_REVIEW"))
      gaps.push({
        priority: row.critical ? "HIGH" : "MEDIUM",
        category: "vendor",
        id: row.id,
        name: row.name,
        reason: "No completed security review was found.",
      });
    return {
      workspaceId: input.workspaceId,
      complete: controls.complete && monitors.complete && personnel.complete && vendors.complete,
      summary: {
        controls: controls.summary,
        monitors: monitors.statusCounts,
        personnel: personnel.summary,
        vendors: vendors.summary,
      },
      gaps,
      unknowns: {
        personnel: personnel.summary.unknownComplianceCount,
        vendorReviews: vendors.summary.unknownReviewCount,
      },
      note: "Unknown or unavailable compliance data is not counted as a failure. Counts describe the retrieved data; complete must be true for a full account analysis.",
    };
  },
  get_framework_requirement_readiness_rollup(input, context) {
    return frameworkReadiness(input, context);
  },
};

interface ControlCheck {
  complete: boolean;
  summary: Record<string, unknown>;
  controls: Record<string, unknown>[];
  unmatchedCodes: string[];
}
async function checkControls(input: Record<string, unknown>, context: DrataActionContext): Promise<ControlCheck> {
  const page = await readDrataList(context, `${drataWorkspacePath(input)}/controls`, {
    fetchAll: true,
    maxResults: 10000,
    expand: ["flags", "evidenceIds", "testIds", "frameworkTags"],
  });
  let rows = looseArray(page.data).map((value) => {
    const row = recordOrEmpty(value),
      flags = recordOrEmpty(row.flags),
      evidence = recordOrEmpty(row.evidenceIds),
      tests = recordOrEmpty(row.testIds);
    const externalEvidenceCount =
      looseArray(evidence.validExternalEvidenceIds).length + looseArray(evidence.invalidExternalEvidenceIds).length;
    const evidenceLibraryReportCount =
      looseArray(evidence.validReportIds).length + looseArray(evidence.invalidReportIds).length;
    const monitorTestCount = looseArray(tests.monitored).length;
    return {
      id: row.id,
      code: row.code,
      name: row.name,
      archivedAt: row.archivedAt ?? null,
      frameworkTags: looseArray(row.frameworkTags),
      isReady: flags.isReady === true,
      hasOwner: flags.hasOwner === true,
      isMonitored: flags.isMonitored === true,
      hasEvidence:
        externalEvidenceCount > 0 || evidenceLibraryReportCount > 0 || flags.hasPolicy === true || monitorTestCount > 0,
      evidence: {
        externalEvidenceCount,
        evidenceLibraryReportCount,
        hasMappedPolicy: flags.hasPolicy === true,
        monitorTestCount,
        passingTestCount: looseArray(tests.passing).length,
        failingTestCount: looseArray(tests.failing).length,
      },
    };
  });
  if (input.frameworkFilter) {
    const wanted = normalizeFramework(String(input.frameworkFilter));
    rows = rows.filter((row) => row.frameworkTags.some((tag) => normalizeFramework(String(tag)) === wanted));
    if (!rows.length)
      throw providerInputError(
        "No controls match this framework. Check list_frameworks for the workspace's framework tags.",
      );
  }
  const codes = looseArray(input.codes).map((value) => String(value).trim().toUpperCase());
  const unmatchedCodes = codes.filter((code) => !rows.some((row) => String(row.code).toUpperCase() === code));
  if (codes.length) rows = rows.filter((row) => codes.includes(String(row.code).toUpperCase()));
  const archived = rows.filter((row) => row.archivedAt !== null).length;
  if (input.includeArchived !== true) rows = rows.filter((row) => row.archivedAt === null);
  const summary = {
    totalControls: rows.length,
    readyControls: rows.filter((row) => row.isReady).length,
    controlsWithAnyEvidence: rows.filter((row) => row.hasEvidence).length,
    archivedControlsExcluded: input.includeArchived === true ? 0 : archived,
  };
  const selected = rows.filter((row) =>
    input.filter === "ready"
      ? row.isReady
      : input.filter === "not_ready"
        ? !row.isReady
        : input.filter === "no_evidence"
          ? !row.hasEvidence
          : input.filter === "no_owner"
            ? !row.hasOwner
            : input.filter === "not_monitored"
              ? !row.isMonitored
              : true,
  );
  const fields = looseArray(input.fields).map(String);
  const controls: Record<string, unknown>[] = selected.map((row) =>
    fields.length
      ? Object.fromEntries(fields.filter((key) => Object.hasOwn(row, key)).map((key) => [key, recordOrEmpty(row)[key]]))
      : row,
  );
  return { complete: !optionalRecord(page.pagination)?.cursor, summary, unmatchedCodes, controls };
}

interface MonitorCheck {
  complete: boolean;
  statusCounts: Record<string, number>;
  monitors: Record<string, unknown>[];
  totalMonitors: number;
  matched: number;
  returned: number;
  page: number;
  hasMore: boolean;
  note: string;
}
async function checkMonitors(input: Record<string, unknown>, context: DrataActionContext): Promise<MonitorCheck> {
  const page = await readDrataLegacyList(context, "/monitors", { fetchAll: true });
  const rows = page.data.map(recordOrEmpty);
  const statusCounts = { passing: 0, failing: 0, disabled: 0, error: 0, testing: 0, unknown: 0 };
  const entries = rows.map((row) => {
    const disabled = row.checkStatus === "DISABLED",
      passing = !disabled && ["READY", "PASSED"].includes(String(row.checkResultStatus)),
      error = !disabled && row.checkResultStatus === "ERROR",
      unknown = !disabled && !row.checkResultStatus;
    const state = disabled ? "disabled" : unknown ? "unknown" : passing ? "passing" : "failing";
    statusCounts[state]++;
    if (error) statusCounts.error++;
    if (row.checkStatus === "TESTING") statusCounts.testing++;
    return {
      id: row.id,
      name: row.name,
      status: row.checkResultStatus,
      checkStatus: row.checkStatus,
      priority: row.priority,
      lastCheck: row.lastCheck,
      state,
      failureDetails:
        state === "failing" ? optionalRecord(looseArray(row.monitorInstances)[0])?.failedTestDescription : undefined,
      disabledMessage: disabled ? row.disabledMessage : undefined,
    };
  });
  const matching = entries.filter(
    (row) =>
      !input.filter ||
      input.filter === "all" ||
      input.filter === row.state ||
      (input.filter === "error" && row.status === "ERROR") ||
      (input.filter === "testing" && row.checkStatus === "TESTING"),
  );
  const size = optionalInteger(input.size) ?? 50,
    p = optionalInteger(input.page) ?? 1;
  if (p < 1 || size < 1 || size > 10000) throw providerInputError("Use page >= 1 and size between 1 and 10000.");
  const monitors = matching.slice((p - 1) * size, p * size);
  return {
    complete: page.pagination.nextPage === null,
    statusCounts,
    totalMonitors: rows.length,
    matched: matching.length,
    returned: monitors.length,
    page: p,
    hasMore: p * size < matching.length,
    monitors,
    note: "Error is a subset of failing. Testing monitors retain their last result. failureDetails is a static explanation; use list_monitoring_test_failures for live findings.",
  };
}

interface PersonnelCheck {
  complete: boolean;
  summary: {
    totalPersonnel: number;
    scoredPersonnel: number;
    compliantCount: number;
    nonCompliantCount: number;
    unknownComplianceCount: number;
    nonCurrentCount: number;
  };
  personnel: Record<string, unknown>[];
  missingPolicyAck: unknown[];
  missingBgCheck: unknown[];
  missingTraining: unknown[];
}
async function checkPersonnel(input: Record<string, unknown>, context: DrataActionContext): Promise<PersonnelCheck> {
  const page = await readDrataLegacyList(context, "/personnel", { fetchAll: true });
  const rows = page.data.map((value) => personnelRecord(value, input.fields));
  const personnel = rows.filter(
    (row) => input.includeNonCurrent === true || String(row.employmentStatus).startsWith("CURRENT"),
  );
  return {
    complete: page.pagination.nextPage === null,
    summary: {
      totalPersonnel: rows.length,
      scoredPersonnel: personnel.length,
      compliantCount: personnel.filter((row) => row.isCompliant === true).length,
      nonCompliantCount: personnel.filter((row) => row.isCompliant === false).length,
      unknownComplianceCount: personnel.filter((row) => row.isCompliant === null).length,
      nonCurrentCount: rows.filter((row) => !String(row.employmentStatus).startsWith("CURRENT")).length,
    },
    personnel,
    missingPolicyAck: personnel
      .filter((row) => looseArray(row.failedChecks).includes("ACCEPTED_POLICIES"))
      .map((row) => row.id),
    missingBgCheck: personnel.filter((row) => looseArray(row.failedChecks).includes("BG_CHECK")).map((row) => row.id),
    missingTraining: personnel
      .filter((row) => looseArray(row.failedChecks).includes("SECURITY_TRAINING"))
      .map((row) => row.id),
  };
}

interface VendorCheck {
  complete: boolean;
  summary: {
    totalVendors: number;
    activeVendors: number;
    activeVendorsWithoutCompletedReview: number;
    unknownReviewCount: number;
  };
  vendors: Record<string, unknown>[];
}
async function checkVendors(input: Record<string, unknown>, context: DrataActionContext): Promise<VendorCheck> {
  const page = await readDrataLegacyList(context, "/vendors", { fetchAll: true });
  const vendors: Record<string, unknown>[] = [];
  let complete = page.pagination.nextPage === null;
  // Small batches prevent a large inventory from flooding the per-vendor API.
  for (let offset = 0; offset < page.data.length; offset += 4) {
    const batch = await Promise.all(
      page.data.slice(offset, offset + 4).map(async (value) => {
        const row = recordOrEmpty(value);
        let reviews: unknown[] = [];
        let reviewError: string | null = null;
        let reviewsComplete = false;
        try {
          const result = await readDrataList(context, `/vendors/${drataPathId(row.id, "vendorId")}/security-reviews`, {
            fetchAll: true,
            maxResults: 1000,
          });
          reviews = looseArray(result.data);
          reviewsComplete = !optionalRecord(result.pagination)?.cursor;
        } catch (error) {
          if (context.signal?.aborted) throw error;
          reviewError = error instanceof Error ? error.message : String(error);
        }
        if (!reviewsComplete) complete = false;
        const normalized = reviews.map(recordOrEmpty);
        const completed = normalized.filter(
          (review) => (review.securityReviewStatus ?? review.status) === "COMPLETED",
        ).length;
        const unknown = normalized.filter((review) => !(review.securityReviewStatus ?? review.status)).length;
        return {
          id: row.id,
          name: row.name,
          archived: row.archivedAt != null,
          archivedAt: row.archivedAt ?? null,
          critical: row.critical ?? null,
          risk: row.risk ?? null,
          impactLevel: row.impactLevel ?? null,
          hasPii: row.hasPii ?? null,
          passwordPolicy: row.passwordPolicy ?? null,
          passwordMfaEnabled: row.passwordMfaEnabled ?? null,
          completedReviewCount: completed,
          pendingReviewCount: normalized.length - completed - unknown,
          unverifiableReviewCount: unknown,
          reviewStatus:
            completed > 0 ? "COMPLETED" : !reviewsComplete || unknown > 0 ? "UNKNOWN" : "NO_COMPLETED_REVIEW",
          reviewError,
          reviews: input.includeReviews === true ? normalized : undefined,
        };
      }),
    );
    vendors.push(...batch);
  }
  const active = vendors.filter((row) => !row.archived);
  return {
    complete,
    summary: {
      totalVendors: vendors.length,
      activeVendors: active.length,
      activeVendorsWithoutCompletedReview: active.filter((row) => row.reviewStatus === "NO_COMPLETED_REVIEW").length,
      unknownReviewCount: active.filter((row) => row.reviewStatus === "UNKNOWN").length,
    },
    vendors,
  };
}

function normalizeFramework(value: string): string {
  return value
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .trim();
}
async function frameworkReadiness(input: Record<string, unknown>, context: DrataActionContext): Promise<unknown> {
  const root = drataWorkspacePath(input);
  const [controls, requirements, frameworks] = await Promise.all([
    readDrataList(context, `${root}/controls`, {
      fetchAll: true,
      maxResults: 10000,
      expand: ["flags", "requirements"],
    }),
    readDrataList(context, `${root}/framework-requirements`, { fetchAll: true, maxResults: 10000 }),
    readDrataList(context, `${root}/frameworks`, { fetchAll: true, maxResults: 10000 }),
  ]);
  const framework =
    input.frameworkId === undefined
      ? undefined
      : looseArray(frameworks.data)
          .map(recordOrEmpty)
          .find((row) => String(row.id) === String(input.frameworkId));
  if (input.frameworkId !== undefined && !framework)
    throw providerInputError("The framework was not found in this workspace.");
  let complete = ![controls, requirements, frameworks].some((page) => optionalRecord(page.pagination)?.cursor);
  const byRequirement = new Map<string, Record<string, unknown>[]>();
  for (const value of looseArray(controls.data)) {
    const row = recordOrEmpty(value),
      expansion = optionalRecord(row.requirements),
      refs = looseArray(expansion?.data ?? row.requirements);
    if ((optionalInteger(expansion?.totalCount) ?? refs.length) > refs.length) complete = false;
    for (const ref of refs) {
      const id = String(recordOrEmpty(ref).id);
      const list = byRequirement.get(id) ?? [];
      list.push(row);
      byRequirement.set(id, list);
    }
  }
  const all = looseArray(requirements.data).map(recordOrEmpty);
  const tags = framework
    ? [framework.tag, framework.slug].filter(Boolean).map((value) => normalizeFramework(String(value)))
    : [];
  let missingTags = 0;
  const scoped = all.filter((row) => {
    if (!framework) return true;
    const tag = row.frameworkTag ?? row.frameworkSlug;
    if (!tag) {
      missingTags++;
      return false;
    }
    return tags.includes(normalizeFramework(String(tag)));
  });
  const rollup = scoped.map((row) => {
    const mapped = byRequirement.get(String(row.id)) ?? [],
      live = mapped.filter((control) => control.archivedAt == null);
    return {
      id: row.id,
      name: row.name,
      frameworkTag: row.frameworkTag,
      isInScope: mapped.length === 0 || live.length > 0,
      isReady: live.length > 0 && live.every((control) => optionalRecord(control.flags)?.isReady === true),
      controlCount: live.length,
      archivedControlCount: mapped.length - live.length,
      controls: live.map((control) =>
        input.includeControlDetail === true
          ? control
          : { id: control.id, code: control.code, isReady: optionalRecord(control.flags)?.isReady === true },
      ),
    };
  });
  const size = optionalInteger(input.size) ?? 25,
    page = optionalInteger(input.page) ?? 1;
  if (page < 1 || size < 1 || size > 500) throw providerInputError("Use page >= 1 and size between 1 and 500.");
  const inScope = rollup.filter((row) => row.isInScope).length,
    ready = rollup.filter((row) => row.isReady).length;
  if (missingTags) complete = false;
  return {
    workspaceId: input.workspaceId,
    complete,
    totalRequirements: rollup.length,
    inScopeRequirements: inScope,
    outOfScopeRequirements: rollup.length - inScope,
    readyRequirements: ready,
    notReadyRequirements: inScope - ready,
    drataReported: framework ?? null,
    matchesDrataReported: framework
      ? Number(framework.numInScopeRequirements) === inScope && Number(framework.numReadyInScopeRequirements) === ready
      : null,
    untaggedRequirementsExcluded: missingTags,
    page,
    size,
    hasMore: page * size < rollup.length,
    data: rollup.slice((page - 1) * size, page * size),
    note: complete
      ? undefined
      : "At least one input collection or mapping was incomplete; derived counts are provisional.",
  };
}
