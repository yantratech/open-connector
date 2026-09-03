import type { CredentialValidationResult } from "../../core/types.ts";
import type { ProviderActionHandlers } from "../provider-runtime.ts";

import { createHash } from "node:crypto";
import { compactObject, optionalBoolean, optionalInteger, optionalRecord, optionalString } from "../../core/cast.ts";
import { ProviderRequestError, providerUserAgent, runProviderRequest } from "../provider-runtime.ts";

const kandjiVulnerabilityLicenseNote = "Kandji Vulnerability Management is not enabled for this tenant.";

type KandjiPhase = "validate" | "execute";
type KandjiActionHandler = (input: Record<string, unknown>, context: KandjiActionContext) => Promise<unknown>;

export interface KandjiActionContext {
  apiKey: string;
  apiUrl: string;
  fetcher: typeof fetch;
  signal?: AbortSignal;
}

export const kandjiActionHandlers: ProviderActionHandlers<"kandji", KandjiActionHandler> = {
  async list_blueprints(input, context) {
    const payload = await requestKandjiJson({
      apiUrl: context.apiUrl,
      apiKey: context.apiKey,
      path: "/api/v1/blueprints",
      query: compactObject({
        id: optionalString(input.id),
        id__in: readStringList(input.idIn).join(",") || undefined,
        name: optionalString(input.name),
        limit: optionalInteger(input.limit),
        offset: optionalInteger(input.offset),
      }),
      fetcher: context.fetcher,
      signal: context.signal,
      phase: "execute",
    });
    const record = requireObject(payload, "Kandji blueprints response");

    return {
      count: typeof record.count === "number" ? record.count : null,
      pagination: normalizePagination(record),
      blueprints: normalizeBlueprintList(record.results),
    };
  },

  async get_blueprint(input, context) {
    const payload = await requestKandjiJson({
      apiUrl: context.apiUrl,
      apiKey: context.apiKey,
      path: `/api/v1/blueprints/${encodeURIComponent(readRequiredString(input.blueprintId, "blueprintId"))}`,
      query: {},
      fetcher: context.fetcher,
      signal: context.signal,
      phase: "execute",
      notFoundAsInvalidInput: true,
    });

    return {
      blueprint: normalizeBlueprint(requireObject(payload, "Kandji blueprint response")),
    };
  },

  async list_users(input, context) {
    const archived = optionalBoolean(input.archived);
    const payload = await requestKandjiJson({
      apiUrl: context.apiUrl,
      apiKey: context.apiKey,
      path: "/api/v1/users",
      query: compactObject({
        email: optionalString(input.email),
        id: optionalString(input.id),
        integration_id: optionalString(input.integrationId),
        archived: archived === undefined ? undefined : String(archived),
        cursor: optionalString(input.cursor),
        sizePerPage: optionalInteger(input.sizePerPage),
      }),
      fetcher: context.fetcher,
      signal: context.signal,
      phase: "execute",
    });
    const record = requireObject(payload, "Kandji users response");

    return {
      pagination: normalizePagination(record),
      users: normalizeUserList(record.results),
    };
  },

  async get_user(input, context) {
    const payload = await requestKandjiJson({
      apiUrl: context.apiUrl,
      apiKey: context.apiKey,
      path: `/api/v1/users/${encodeURIComponent(readRequiredString(input.userId, "userId"))}`,
      query: {},
      fetcher: context.fetcher,
      signal: context.signal,
      phase: "execute",
      notFoundAsInvalidInput: true,
    });

    return {
      user: normalizeUser(requireObject(payload, "Kandji user response")),
    };
  },

  async list_devices(input, context) {
    const filevaultEnabled = optionalBoolean(input.filevaultEnabled);
    const payload = await executeKandjiGet(context, "/api/v1/devices", {
      platform: optionalString(input.platform),
      blueprint_id: optionalString(input.blueprintId),
      serial_number: optionalString(input.serialNumber),
      asset_tag: optionalString(input.assetTag),
      user_email: optionalString(input.userEmail),
      filevault_enabled: filevaultEnabled === undefined ? undefined : String(filevaultEnabled),
      limit: optionalInteger(input.limit),
      offset: optionalInteger(input.offset),
    });
    const page = normalizeKandjiList(payload);
    return {
      returned: page.items.length,
      total: page.total,
      pagination: page.pagination,
      devices: page.items,
    };
  },

  get_device(input, context) {
    return executeKandjiGet(context, devicePath(input.deviceId));
  },

  async get_device_details(input, context) {
    const path = devicePath(input.deviceId);
    const [details, summary] = await Promise.all([
      executeKandjiGet(context, `${path}/details`),
      executeKandjiGet(context, path).catch(() => null),
    ]);
    return enrichDeviceModel(details, summary);
  },

  async get_device_apps(input, context) {
    const payload = await executeKandjiGet(context, `${devicePath(input.deviceId)}/apps`);
    const record = optionalRecord(payload);
    const apps = Array.isArray(payload) ? payload : Array.isArray(record?.apps) ? record.apps : [];
    return { count: apps.length, apps };
  },

  async get_device_status(input, context) {
    const payload = await executeKandjiGet(context, `${devicePath(input.deviceId)}/status`);
    const record = requireObject(payload, "Kandji device status response");
    return {
      ...record,
      note: "Kandji status values use mixed vocabularies upstream. Compare case-insensitively and treat success and PASS as equivalent.",
    };
  },

  async get_device_activity(input, context) {
    const payload = await executeKandjiGet(context, `${devicePath(input.deviceId)}/activity`, {
      limit: optionalInteger(input.limit) ?? 50,
      offset: optionalInteger(input.offset) ?? 0,
    });
    const envelope = optionalRecord(requireObject(payload, "Kandji device activity response").activity) ?? {};
    const page = normalizeKandjiList(envelope);
    return {
      returned: page.items.length,
      total: page.total,
      pagination: page.pagination,
      activity: page.items,
    };
  },

  async get_audit_events(input, context) {
    const payload = await executeKandjiGet(context, "/api/v1/audit/events", {
      start_date: optionalString(input.startDate),
      end_date: optionalString(input.endDate),
      limit: optionalInteger(input.limit) ?? 50,
      offset: optionalInteger(input.offset) ?? 0,
    });
    const page = normalizeKandjiList(payload);
    return {
      returned: page.items.length,
      total: page.total,
      pagination: page.pagination,
      events: page.items,
    };
  },

  async list_vulnerabilities(input, context) {
    return executeVulnerabilityList(context, "/api/v1/vulnerability-management/vulnerabilities", "vulnerabilities", {
      severity: optionalString(input.severity),
      page: optionalInteger(input.page) ?? 1,
      size: optionalInteger(input.size) ?? 50,
    });
  },

  async get_vulnerability(input, context) {
    try {
      return await executeKandjiGet(
        context,
        `/api/v1/vulnerability-management/vulnerabilities/${encodeURIComponent(readRequiredString(input.cveId, "cveId"))}`,
      );
    } catch (error) {
      if (isKandjiVulnerabilityLicenseError(error)) {
        return { license_gated: true, note: kandjiVulnerabilityLicenseNote };
      }
      throw error;
    }
  },

  async get_vulnerability_devices(input, context) {
    return executeVulnerabilityList(
      context,
      `/api/v1/vulnerability-management/vulnerabilities/${encodeURIComponent(readRequiredString(input.cveId, "cveId"))}/devices`,
      "devices",
      vulnerabilityPagination(input),
    );
  },

  async get_vulnerability_software(input, context) {
    return executeVulnerabilityList(
      context,
      `/api/v1/vulnerability-management/vulnerabilities/${encodeURIComponent(readRequiredString(input.cveId, "cveId"))}/software`,
      "software",
      vulnerabilityPagination(input),
    );
  },

  async list_vulnerability_detections(input, context) {
    return executeVulnerabilityList(context, "/api/v1/vulnerability-management/detections", "detections", {
      cve_id: optionalString(input.cveId),
      device_id: optionalString(input.deviceId),
      ...vulnerabilityPagination(input),
    });
  },
};

export async function validateKandjiCredential(
  input: { apiKey: string; values: Record<string, string> },
  fetcher: typeof fetch,
  signal?: AbortSignal,
): Promise<CredentialValidationResult> {
  const apiUrl = normalizeKandjiApiUrl(input.values.apiUrl);
  const payload = await requestKandjiJson({
    apiUrl,
    apiKey: input.apiKey,
    path: "/api/v1/blueprints",
    query: { limit: 1 },
    fetcher,
    signal,
    phase: "validate",
  });
  const record = requireObject(payload, "Kandji credential validation response");
  const blueprints = normalizeBlueprintList(record.results);
  const host = new URL(apiUrl).host;

  return {
    profile: {
      accountId: `kandji:${hashValue(host).slice(0, 16)}`,
      displayName: `Kandji ${host}`,
    },
    grantedScopes: [],
    metadata: compactObject({
      apiUrl,
      validationEndpoint: "/api/v1/blueprints",
      firstBlueprintName: blueprints[0]?.name,
    }),
  };
}

export function normalizeKandjiApiUrl(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new ProviderRequestError(400, "apiUrl is required");
  }

  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    throw new ProviderRequestError(400, "apiUrl must be a valid URL");
  }

  if (url.protocol !== "https:") {
    throw new ProviderRequestError(400, "apiUrl must use https");
  }

  if (!isAllowedKandjiApiHost(url.hostname)) {
    throw new ProviderRequestError(400, "apiUrl host must end with .api.kandji.io or .api.eu.kandji.io");
  }

  if (url.pathname !== "/") {
    throw new ProviderRequestError(400, "apiUrl must be the Kandji API root URL");
  }

  url.search = "";
  url.hash = "";
  return url.origin;
}

async function requestKandjiJson(input: {
  apiUrl: string;
  apiKey: string;
  path: string;
  query: Record<string, string | number | boolean | undefined>;
  fetcher: typeof fetch;
  signal?: AbortSignal;
  phase: KandjiPhase;
  notFoundAsInvalidInput?: boolean;
}): Promise<unknown> {
  return runProviderRequest({ signal: input.signal, label: "Kandji" }, async (signal) => {
    const response = await input.fetcher(buildKandjiUrl(input.apiUrl, input.path, input.query), {
      method: "GET",
      headers: buildKandjiHeaders(input.apiKey),
      signal,
    });
    const payload = await readKandjiPayload(response);

    if (!response.ok) {
      throw createKandjiError(response.status, payload, input.phase, input.notFoundAsInvalidInput);
    }

    return payload;
  });
}

function isAllowedKandjiApiHost(hostname: string): boolean {
  const lower = hostname.toLowerCase();
  return hasTenantSuffix(lower, ".api.kandji.io") || hasTenantSuffix(lower, ".api.eu.kandji.io");
}

function hasTenantSuffix(hostname: string, suffix: string): boolean {
  return hostname.endsWith(suffix) && hostname.length > suffix.length;
}

function buildKandjiUrl(
  apiUrl: string,
  path: string,
  query: Record<string, string | number | boolean | undefined>,
): URL {
  const url = new URL(path, `${apiUrl}/`);
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined) {
      url.searchParams.set(key, String(value));
    }
  }
  return url;
}

function buildKandjiHeaders(apiKey: string): Record<string, string> {
  return {
    accept: "application/json",
    authorization: `Bearer ${apiKey}`,
    "user-agent": providerUserAgent,
  };
}

async function readKandjiPayload(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text.trim()) {
    return null;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new ProviderRequestError(502, "Kandji returned invalid JSON");
  }
}

function createKandjiError(
  status: number,
  payload: unknown,
  phase: KandjiPhase,
  notFoundAsInvalidInput?: boolean,
): ProviderRequestError {
  const message = extractKandjiErrorMessage(payload) ?? `Kandji request failed with status ${status}`;

  if (status === 429) {
    return new ProviderRequestError(429, message);
  }
  if (phase === "validate" && status >= 400 && status < 500) {
    return new ProviderRequestError(400, message);
  }
  if (phase === "execute" && status === 401) {
    return new ProviderRequestError(401, message);
  }
  if (phase === "execute" && (status === 404 || status === 400) && notFoundAsInvalidInput) {
    return new ProviderRequestError(status, message);
  }
  if (phase === "execute" && status >= 400 && status < 500) {
    return new ProviderRequestError(status, message);
  }
  return new ProviderRequestError(status || 500, message);
}

function extractKandjiErrorMessage(payload: unknown): string | undefined {
  if (typeof payload === "string" && payload.trim()) {
    return payload;
  }

  const record = optionalRecord(payload);
  if (!record) {
    return undefined;
  }

  return optionalString(record.detail) ?? optionalString(record.message) ?? optionalString(record.error);
}

function normalizePagination(record: Record<string, unknown>) {
  return {
    next: optionalString(record.next) ?? null,
    previous: optionalString(record.previous) ?? null,
  };
}

function executeKandjiGet(
  context: KandjiActionContext,
  path: string,
  query: Record<string, string | number | boolean | undefined> = {},
): Promise<unknown> {
  return requestKandjiJson({
    apiUrl: context.apiUrl,
    apiKey: context.apiKey,
    path,
    query,
    fetcher: context.fetcher,
    signal: context.signal,
    phase: "execute",
    notFoundAsInvalidInput: true,
  });
}

function devicePath(value: unknown): string {
  return `/api/v1/devices/${encodeURIComponent(readRequiredString(value, "deviceId"))}`;
}

function normalizeKandjiList(value: unknown): {
  items: unknown[];
  total: number | null;
  pagination: { next: string | null; previous: string | null };
} {
  if (Array.isArray(value)) {
    return {
      items: value,
      total: null,
      pagination: { next: null, previous: null },
    };
  }
  const record = requireObject(value, "Kandji list response");
  const items = Array.isArray(record.results) ? record.results : Array.isArray(record.data) ? record.data : [];
  return {
    items,
    total: optionalInteger(record.count) ?? optionalInteger(record.total) ?? null,
    pagination: normalizePagination(record),
  };
}

function vulnerabilityPagination(input: Record<string, unknown>): Record<string, number> {
  return {
    page: optionalInteger(input.page) ?? 1,
    size: optionalInteger(input.size) ?? 50,
  };
}

async function executeVulnerabilityList(
  context: KandjiActionContext,
  path: string,
  key: string,
  query: Record<string, string | number | boolean | undefined>,
): Promise<Record<string, unknown>> {
  try {
    return vulnerabilityPage(await executeKandjiGet(context, path, query), key);
  } catch (error) {
    if (isKandjiVulnerabilityLicenseError(error)) {
      return {
        returned: 0,
        total: null,
        page: null,
        [key]: [],
        license_gated: true,
        note: kandjiVulnerabilityLicenseNote,
      };
    }
    throw error;
  }
}

function isKandjiVulnerabilityLicenseError(error: unknown): boolean {
  return (
    error instanceof ProviderRequestError && (error.status === 401 || error.status === 403 || error.status === 404)
  );
}

function vulnerabilityPage(value: unknown, key: string) {
  const record = requireObject(value, "Kandji vulnerability response");
  const page = normalizeKandjiList(record);
  return {
    returned: page.items.length,
    total: page.total,
    page: optionalInteger(record.page) ?? null,
    [key]: page.items,
    license_gated: false,
  };
}

function enrichDeviceModel(details: unknown, summary: unknown): unknown {
  const detailsRecord = optionalRecord(details);
  const summaryRecord = optionalRecord(summary);
  const hardware = optionalRecord(detailsRecord?.hardware_overview);
  const marketingModel = optionalString(summaryRecord?.model);
  const currentModel = optionalString(hardware?.model_name);
  if (
    !detailsRecord ||
    !hardware ||
    !marketingModel ||
    (currentModel && !/^(Mac|iPhone|iPad|AppleTV|Apple TV|VisionPro|Vision Pro)$/iu.test(currentModel))
  ) {
    return details;
  }
  return {
    ...detailsRecord,
    hardware_overview: {
      ...hardware,
      model_name: marketingModel,
      model_name_raw: currentModel ?? null,
    },
  };
}

function normalizeBlueprintList(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((item) => normalizeBlueprint(requireObject(item, "Kandji blueprint record")));
}

function normalizeBlueprint(record: Record<string, unknown>) {
  return {
    id: optionalString(record.id) ?? "",
    name: optionalString(record.name) ?? "",
    type: optionalString(record.type) ?? null,
    description: optionalString(record.description) ?? null,
    computersCount: optionalInteger(record.computers_count) ?? null,
    raw: record,
  };
}

function normalizeUserList(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((item) => normalizeUser(requireObject(item, "Kandji user record")));
}

function normalizeUser(record: Record<string, unknown>) {
  return {
    id: optionalString(record.id) ?? "",
    email: optionalString(record.email) ?? null,
    name: optionalString(record.name) ?? null,
    active: optionalBoolean(record.active) ?? null,
    archived: optionalBoolean(record.archived) ?? null,
    deviceCount: optionalInteger(record.device_count) ?? null,
    raw: record,
  };
}

function requireObject(value: unknown, label: string): Record<string, unknown> {
  const record = optionalRecord(value);
  if (!record) {
    throw new ProviderRequestError(502, `${label} is not a JSON object`);
  }
  return record;
}

function readRequiredString(value: unknown, fieldName: string): string {
  const text = optionalString(value);
  if (!text) {
    throw new ProviderRequestError(400, `${fieldName} is required`);
  }
  return text;
}

function readStringList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((item) => String(item)).filter((item) => item.trim());
}

function hashValue(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
