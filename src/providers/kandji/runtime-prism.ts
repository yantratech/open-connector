import type { ProviderActionHandlerSubset, ProviderRuntimeHandler } from "../provider-runtime.ts";
import type { KandjiActionContext } from "./runtime-request.ts";

import { looseArray, optionalInteger, optionalRecord, optionalString, recordOrEmpty } from "../../core/cast.ts";
import {
  mapProviderActionNames,
  providerInputError,
  requiredInputString,
  requiredResponseRecord,
} from "../provider-runtime.ts";
import { prismCategories } from "./prism-categories.ts";
import { kandjiPathSegment, readKandjiPage, requestKandjiJson } from "./runtime-request.ts";

const deviceFields = new Set([
  "device_name",
  "name",
  "model",
  "model_id",
  "model_name",
  "platform",
  "serial_number",
  "udid",
  "os_version",
  "supplementary_os_version_extra",
  "supplementary_build_version",
  "last_check_in",
  "first_enrollment",
  "agent_installed_at",
  "mdm_enabled",
  "ade_eligibility",
  "ade_enrolled",
  "enrollment_type",
  "user_id",
  "user_email",
  "user_name",
  "user",
  "blueprint_id",
  "blueprint_name",
  "asset_tag",
  "tags",
]);
const highVolumeCategories = new Set(["apps", "local_users", "transparency_database", "launch_agents_and_daemons"]);

export const kandjiPrismHandlers: ProviderActionHandlerSubset<"kandji", ProviderRuntimeHandler<KandjiActionContext>> = {
  ...mapProviderActionNames(
    "kandji",
    prismCategories.map((category) => `prism_${category}`),
    (name) => (input: Record<string, unknown>, context: KandjiActionContext) =>
      readPrism(input, context, name.slice("prism_".length)),
  ),
  async prism_count(_input, context) {
    const counts: Record<string, number | null> = {};
    const errors: Record<string, string> = {};
    await Promise.all(
      prismCategories.map(async (category) => {
        try {
          const payload = await requestKandjiJson({
            ...context,
            path: "/api/v1/prism/count",
            query: { category },
            phase: "execute",
          });
          const record = optionalRecord(payload);
          counts[category] =
            optionalInteger(payload) ??
            optionalInteger(record?.count) ??
            optionalInteger(record?.total) ??
            optionalInteger(record?.value) ??
            null;
        } catch (error) {
          if (context.signal?.aborted) throw error;
          counts[category] = null;
          errors[category] = error instanceof Error ? error.message : String(error);
        }
      }),
    );
    return { counts, errors };
  },
  prism_request_export(input, context) {
    const category = requiredInputString(input.category, "category");
    if (!prismCategories.includes(category)) throw providerInputError("Unknown Prism category.");
    const filters = recordOrEmpty(input.filters);
    const reserved = ["category", "device_families", "blueprint_ids"].filter((key) => key in filters);
    if (reserved.length)
      throw providerInputError(`Use dedicated export parameters instead of filters.${reserved.join(", filters.")}.`);
    return requestKandjiJson({
      ...context,
      path: "/api/v1/prism/export",
      method: "POST",
      body: {
        ...filters,
        category,
        device_families: input.device_families,
        blueprint_ids: input.blueprint_ids ?? ["*"],
      },
      phase: "execute",
    });
  },
  prism_get_export(input, context) {
    return requestKandjiJson({
      ...context,
      path: `/api/v1/prism/export/${kandjiPathSegment(input.exportId, "exportId")}`,
      phase: "execute",
    });
  },
};

async function readPrism(
  input: Record<string, unknown>,
  context: KandjiActionContext,
  category: string,
): Promise<unknown> {
  const cap = optionalInteger(input.maxResults) ?? (highVolumeCategories.has(category) ? 20 : 50);
  const offset = optionalInteger(input.offset) ?? 0;
  const page = await readKandjiPage(context, `/api/v1/prism/${category}`, { maxResults: cap + 1, offset });
  const truncated = page.items.length > cap || page.hasMore;
  const { devices, rows } = compactPrismRows(page.items.slice(0, cap));
  const common = {
    category,
    returned: rows.length,
    totalAvailable: page.count,
    truncated,
    nextOffset: truncated ? offset + rows.length : null,
    defaultCapApplied: input.maxResults === undefined ? cap : undefined,
    devicesInSlice: Object.keys(devices).length,
    devices,
    note: truncated
      ? "This is a partial inventory slice. Device counts describe only the returned rows; use prism_count for full category totals."
      : undefined,
  };
  if (input.summary === true) {
    const byDevice: Record<string, number> = {};
    for (const row of rows) {
      const id = optionalString(row.device_id) ?? "_unknown";
      byDevice[id] = (byDevice[id] ?? 0) + 1;
    }
    return { ...common, byDevice, sample: rows.slice(0, 3) };
  }
  const fields = looseArray(input.fields).map((value) => requiredInputString(value, "fields"));
  if (!fields.length) return { ...common, rows };
  const projected = [...new Set(["device_id", ...fields])];
  const observed = new Set(rows.flatMap((row) => Object.keys(row)));
  return {
    ...common,
    fieldsProjected: projected,
    fieldsUnknown: rows.length ? fields.filter((field) => field !== "device_id" && !observed.has(field)) : [],
    rows: rows.map((row) =>
      Object.fromEntries(projected.filter((field) => field in row).map((field) => [field, row[field]])),
    ),
  };
}

function compactPrismRows(values: unknown[]): {
  devices: Record<string, Record<string, unknown>>;
  rows: Record<string, unknown>[];
} {
  const groups = new Map<string, Record<string, unknown>[]>();
  const rows: Record<string, unknown>[] = [];
  const devices: Record<string, Record<string, unknown>> = Object.create(null);
  for (const value of values) {
    const row = requiredResponseRecord(value, "Prism row");
    const id = optionalString(row.device_id);
    if (!id) {
      rows.push(row);
      continue;
    }
    const group = groups.get(id) ?? [];
    group.push(row);
    groups.set(id, group);
  }
  for (const [id, group] of groups) {
    const fields = new Set(group.flatMap((row) => Object.keys(row)));
    const hoisted = new Set(
      [...fields].filter((field) => {
        if (field === "device_id") return false;
        if (deviceFields.has(field)) return true;
        const first = group[0]?.[field];
        return (
          group.length >= 3 &&
          first !== undefined &&
          first !== null &&
          typeof first !== "object" &&
          group.every((row) => row[field] === first)
        );
      }),
    );
    devices[id] = Object.fromEntries([["device_id", id], ...[...hoisted].map((field) => [field, group[0]?.[field]])]);
    for (const row of group)
      rows.push(Object.fromEntries(Object.entries(row).filter(([field]) => !hoisted.has(field))));
  }
  return { devices, rows };
}
