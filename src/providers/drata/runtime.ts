import type { CredentialValidationResult } from "../../core/types.ts";
import type { ProviderActionHandlers } from "../provider-runtime.ts";
import type { DrataActionContext } from "./runtime-request.ts";

import { booleanString, compactObject } from "../../core/cast.ts";
import { combineProviderActionHandlers, ProviderRequestError } from "../provider-runtime.ts";
import { drataAuditHandlers } from "./runtime-audits.ts";
import { drataComplianceHandlers } from "./runtime-compliance.ts";
import { drataControlHandlers } from "./runtime-controls.ts";
import { drataCustomHandlers } from "./runtime-custom.ts";
import { drataDirectoryHandlers } from "./runtime-directory.ts";
import { drataDocumentsHandlers } from "./runtime-documents.ts";
import { drataEvidenceHandlers } from "./runtime-evidence.ts";
import { drataGithubHandlers } from "./runtime-github.ts";
import { readDrataLegacyList } from "./runtime-legacy.ts";
import { readMonitoringTest } from "./runtime-monitoring.ts";
import { drataPeopleHandlers } from "./runtime-people.ts";
import { personnelRecord } from "./runtime-personnel.ts";
import { drataPolicyHandlers } from "./runtime-policies.ts";
import { requestDrataJson } from "./runtime-request.ts";
import { drataRiskHandlers } from "./runtime-risks.ts";
import { drataVendorsHandlers } from "./runtime-vendors.ts";

export const drataRegionBaseUrls = {
  us: "https://public-api.drata.com/public/v2",
  eu: "https://public-api.eu.drata.com/public/v2",
  apac: "https://public-api.apac.drata.com/public/v2",
} as const;

export const drataDefaultRegion = "us" as const;

type DrataRegion = keyof typeof drataRegionBaseUrls;

type DrataActionHandler = (input: Record<string, unknown>, context: DrataActionContext) => Promise<unknown>;

export const drataActionHandlers: ProviderActionHandlers<"drata", DrataActionHandler> = combineProviderActionHandlers(
  "drata",
  drataGithubHandlers,
  drataComplianceHandlers,
  drataPeopleHandlers,
  drataVendorsHandlers,
  drataEvidenceHandlers,
  drataPolicyHandlers,
  drataCustomHandlers,
  drataDirectoryHandlers,
  drataDocumentsHandlers,
  drataControlHandlers,
  drataRiskHandlers,
  drataAuditHandlers,
  {
    get_company(_input, context) {
      return getCompany(context);
    },
    list_workspaces(input, context) {
      return listRecords("/workspaces", input, context, {});
    },
    async list_personnel(input, context) {
      const result = await readDrataLegacyList(context, "/personnel", input, ["employmentStatus", "complianceStatus"]);
      return { ...result, data: result.data.map((value) => personnelRecord(value, input.fields)) };
    },
    get_personnel(input, context) {
      return getRecord(
        `/personnel/${encodeURIComponent(requirePathIdentifier(input.personnelId, "personnelId"))}`,
        input,
        context,
        "personnel",
      );
    },
    list_controls(input, context) {
      const workspaceId = requireInteger(input.workspaceId, "workspaceId");
      return listRecords(`/workspaces/${workspaceId}/controls`, input, context, {
        isMonitored: booleanString(input.isMonitored),
        isReady: booleanString(input.isReady),
        hasEvidence: booleanString(input.hasEvidence),
        hasPolicy: booleanString(input.hasPolicy),
        hasPassingTest: booleanString(input.hasPassingTest),
        ticketStatus: asOptionalString(input.ticketStatus),
        policyId: asOptionalIntegerString(input.policyId),
        isEnabled: booleanString(input.isEnabled),
        isArchived: booleanString(input.isArchived),
      });
    },
    get_control(input, context) {
      const workspaceId = requireInteger(input.workspaceId, "workspaceId");
      const controlId = requirePathIdentifier(input.controlId, "controlId");
      return getRecord(
        `/workspaces/${workspaceId}/controls/${encodeURIComponent(controlId)}`,
        input,
        context,
        "control",
        {
          cursor: asOptionalString(input.cursor),
          size: asOptionalIntegerString(input.size),
          sort: asOptionalString(input.sort),
          sortDir: asOptionalSortDirection(input.sortDir),
        },
      );
    },
    list_vendors(input, context) {
      return listRecords("/vendors", input, context, {
        category: asOptionalString(input.category),
        impactLevel: asOptionalString(input.impactLevel),
        renewalDate: asOptionalString(input.renewalDate),
        renewalScheduleType: asOptionalString(input.renewalScheduleType),
        risk: asOptionalString(input.risk),
        status: asOptionalString(input.status),
        type: asOptionalString(input.type),
      });
    },
    get_vendor(input, context) {
      const vendorId = requireInteger(input.vendorId, "vendorId");
      return getRecord(`/vendors/${vendorId}`, input, context, "vendor");
    },
    async list_assets(input, context) {
      const result = await listRecords(
        "/assets",
        input,
        context,
        { page: asOptionalIntegerString(input.page) },
        legacyDrataBaseUrl(context.baseUrl),
      );
      if (input.includeRemoved !== true) {
        result.data = result.data.filter((item) => asObject(item)?.removedAt == null);
        result.raw = { ...result.raw, data: result.data };
      }
      return result;
    },
    list_monitors(input, context) {
      return listRecords(
        "/monitors",
        input,
        context,
        { page: asOptionalIntegerString(input.page) },
        legacyDrataBaseUrl(context.baseUrl),
      );
    },
    list_policies(input, context) {
      return listRecords(
        "/policies",
        input,
        context,
        { page: asOptionalIntegerString(input.page) },
        legacyDrataBaseUrl(context.baseUrl),
      );
    },
    async list_events(input, context) {
      const since = asOptionalString(input.since);
      const sinceTimestamp = since === undefined ? undefined : Date.parse(since);
      if (sinceTimestamp !== undefined && !Number.isFinite(sinceTimestamp)) {
        throw new ProviderRequestError(400, "since must be a valid ISO 8601 timestamp");
      }
      const result = await listRecords("/events", input, context, {
        size: asOptionalIntegerString(input.size) ?? "50",
        sort: asOptionalString(input.sort) ?? "createdAt",
        sortDir: asOptionalSortDirection(input.sortDir) ?? "DESC",
        type: asOptionalString(input.type),
        category: asOptionalString(input.category),
        createdAtFrom: since,
      });
      if (sinceTimestamp !== undefined) {
        result.data = result.data.filter((event) => {
          const createdAt = asOptionalString(asObject(event)?.createdAt);
          const eventTimestamp = createdAt === undefined ? Number.NaN : Date.parse(createdAt);
          return Number.isFinite(eventTimestamp) && eventTimestamp >= sinceTimestamp;
        });
        result.raw = { ...result.raw, data: result.data };
      }
      return result;
    },
    list_frameworks(input, context) {
      const workspaceId = requireInteger(input.workspaceId, "workspaceId");
      return listRecords(`/workspaces/${workspaceId}/frameworks`, input, context, {});
    },
    list_framework_requirements(input, context) {
      const workspaceId = requireInteger(input.workspaceId, "workspaceId");
      return listRecords(`/workspaces/${workspaceId}/framework-requirements`, input, context, {
        size: asOptionalIntegerString(input.size) ?? "20",
        includeTotalCount: booleanString(input.includeTotalCount) ?? "true",
      });
    },
    list_evidence_library(input, context) {
      const workspaceId = requireInteger(input.workspaceId, "workspaceId");
      return listRecords(`/workspaces/${workspaceId}/evidence-library`, input, context, {
        name: asOptionalString(input.name),
        "statuses[]": asOptionalStringArray(input.statuses),
        size: asOptionalIntegerString(input.size) ?? "50",
        includeTotalCount: booleanString(input.includeTotalCount) ?? "true",
      });
    },
    get_evidence_item(input, context) {
      const workspaceId = requireInteger(input.workspaceId, "workspaceId");
      const evidenceId = requireInteger(input.evidenceId, "evidenceId");
      return getRawRecord(`/workspaces/${workspaceId}/evidence-library/${evidenceId}`, input, context);
    },
    list_risk_registers(input, context) {
      return listRecords("/risk-registers", input, context, {});
    },
    list_monitoring_tests(input, context) {
      const workspaceId = requireInteger(input.workspaceId, "workspaceId");
      return listRecords(`/workspaces/${workspaceId}/monitoring-tests`, input, context, {
        size: asOptionalIntegerString(input.size) ?? "50",
        includeTotalCount: booleanString(input.includeTotalCount) ?? "true",
      });
    },
    get_monitoring_test(input, context) {
      return readMonitoringTest(input, context, false);
    },
  },
);

export async function validateDrataCredential(
  input: { apiKey: string; values: Record<string, string> },
  fetcher: typeof fetch,
  signal?: AbortSignal,
): Promise<CredentialValidationResult> {
  const apiKey = input.apiKey;
  const region = normalizeDrataRegion(input.values.region);
  const baseUrl = drataRegionBaseUrls[region];
  const company = requireObject(
    await requestDrataJson({
      path: "/company",
      apiKey,
      baseUrl,
      fetcher,
      mode: "validate",
      signal,
    }),
    "Drata company response",
  );

  return {
    profile: {
      accountId: readNonEmptyString(company.accountId) ?? readNonEmptyString(company.domain) ?? `drata_${region}`,
      displayName: readNonEmptyString(company.name) ?? readNonEmptyString(company.domain) ?? "Drata API Key",
    },
    grantedScopes: [],
    metadata: compactObject({
      region,
      baseUrl,
      accountId: readNonEmptyString(company.accountId),
      domain: readNonEmptyString(company.domain),
      companyName: readNonEmptyString(company.name),
    }),
  };
}

function getCompany(context: DrataActionContext) {
  return requestDrataJson({
    path: "/company",
    apiKey: context.apiKey,
    baseUrl: context.baseUrl,
    fetcher: context.fetcher,
    mode: "execute",
    signal: context.signal,
  }).then((payload) => {
    const company = requireObject(payload, "Drata company response");
    return {
      company,
      raw: company,
    };
  });
}

async function listRecords(
  path: string,
  input: Record<string, unknown>,
  context: DrataActionContext,
  extraQuery: Record<string, string | string[] | undefined>,
  baseUrl = context.baseUrl,
) {
  if (baseUrl !== context.baseUrl) return readDrataLegacyList(context, path, input);
  const payload = requireObject(
    await requestDrataJson({
      path,
      apiKey: context.apiKey,
      baseUrl,
      fetcher: context.fetcher,
      mode: "execute",
      signal: context.signal,
      query: {
        ...commonListQuery(input),
        ...extraQuery,
      },
    }),
    "Drata list response",
  );

  return {
    data: readArray(payload.data, "data"),
    pagination: asObject(payload.pagination) ?? {},
    raw: payload,
  };
}

async function getRawRecord(path: string, input: Record<string, unknown>, context: DrataActionContext) {
  return requireObject(
    await requestDrataJson({
      path,
      apiKey: context.apiKey,
      baseUrl: context.baseUrl,
      fetcher: context.fetcher,
      mode: "execute",
      signal: context.signal,
      query: {
        "expand[]": asOptionalStringArray(input.expand),
      },
    }),
    "Drata record response",
  );
}

async function getRecord(
  path: string,
  input: Record<string, unknown>,
  context: DrataActionContext,
  outputKey: "personnel" | "control" | "vendor",
  query: Record<string, string | undefined> = {},
) {
  const record = requireObject(
    await requestDrataJson({
      path,
      apiKey: context.apiKey,
      baseUrl: context.baseUrl,
      fetcher: context.fetcher,
      mode: "execute",
      signal: context.signal,
      query: {
        ...query,
        "expand[]": asOptionalStringArray(input.expand),
      },
    }),
    `Drata ${outputKey} response`,
  );

  return {
    [outputKey]: record,
    raw: record,
  };
}

function commonListQuery(input: Record<string, unknown>) {
  return compactObject({
    cursor: asOptionalString(input.cursor),
    size: asOptionalIntegerString(input.size),
    sort: asOptionalString(input.sort),
    sortDir: asOptionalString(input.sortDir),
    includeTotalCount: booleanString(input.includeTotalCount),
    "expand[]": asOptionalStringArray(input.expand),
  });
}

function legacyDrataBaseUrl(baseUrl: string): string {
  const legacy = baseUrl.replace(/\/v2\/?$/u, "");
  if (legacy === baseUrl) {
    throw new ProviderRequestError(500, "Drata v2 base URL is malformed");
  }
  return legacy;
}

function normalizeDrataRegion(value: unknown): DrataRegion {
  if (typeof value !== "string" || value.trim() === "") {
    return drataDefaultRegion;
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === "us" || normalized === "eu" || normalized === "apac") {
    return normalized;
  }

  throw new ProviderRequestError(400, "drata region must be one of: us, eu, apac");
}

function requireObject(value: unknown, fieldName: string) {
  const object = asObject(value);
  if (!object) {
    throw new ProviderRequestError(502, `${fieldName} must be an object`);
  }

  return object;
}

function asObject(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function readArray(value: unknown, fieldName: string) {
  if (!Array.isArray(value)) {
    throw new ProviderRequestError(502, `Drata ${fieldName} must be an array`);
  }

  return value;
}

function requireInteger(value: unknown, fieldName: string) {
  if (!Number.isInteger(value)) {
    throw new ProviderRequestError(400, `${fieldName} must be an integer`);
  }

  return String(value);
}

function requirePathIdentifier(value: unknown, fieldName: string) {
  if (Number.isInteger(value)) {
    return String(value);
  }

  if (typeof value === "string" && value.trim() !== "") {
    return value.trim();
  }

  throw new ProviderRequestError(400, `${fieldName} must be an integer or non-empty string`);
}

function asOptionalString(value: unknown) {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : undefined;
}

function asOptionalSortDirection(value: unknown): string | undefined {
  return asOptionalString(value)?.toUpperCase();
}

function asOptionalStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const values = value.map((item) => (typeof item === "string" ? item.trim() : "")).filter((item) => item !== "");
  return values.length > 0 ? values : undefined;
}

function asOptionalIntegerString(value: unknown) {
  return Number.isInteger(value) ? String(value) : undefined;
}

function readNonEmptyString(value: unknown, fieldName?: string) {
  const source = fieldName && asObject(value) ? asObject(value)?.[fieldName] : value;
  return typeof source === "string" && source.trim() !== "" ? source.trim() : undefined;
}
