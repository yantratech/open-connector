import type { ActionDefinition } from "../../core/types.ts";

import { s } from "../../core/json-schema.ts";
import { defineProviderAction } from "../../core/provider-definition.ts";
import { prismCategories } from "./prism-categories.ts";

const exportLifecycle = { startActionId: "kandji.prism_request_export", statusActionId: "kandji.prism_get_export" };
const prismOutput = s.object(
  "A bounded inventory slice with device metadata separated from the inventory rows. Counts describe this slice unless explicitly identified as the upstream total.",
  {
    category: s.string(),
    returned: s.integer(),
    totalAvailable: s.nullableInteger("The upstream total, or null when unknown."),
    truncated: s.boolean(),
    nextOffset: s.nullableInteger("Resume at this offset when more rows exist."),
    defaultCapApplied: s.integer(),
    devicesInSlice: s.integer(),
    devices: s.record(s.looseObject("Device metadata.")),
    rows: s.array(s.looseObject("Category data for one device.")),
    byDevice: s.record(s.integer()),
    sample: s.array(s.looseObject("A sample inventory row.")),
    fieldsUnknown: s.array(s.string()),
    fieldsProjected: s.array(s.string()),
    note: s.string(),
  },
  { required: ["category", "returned", "totalAvailable", "truncated", "nextOffset", "devicesInSlice", "devices"] },
);

export const kandjiPrismActions: ActionDefinition[] = [
  ...prismCategories.map((category) =>
    defineProviderAction("kandji", {
      name: `prism_${category}`,
      description: `Read ${category.replaceAll("_", " ")} inventory through Prism. Results are a bounded slice; use the returned offset to continue or request a CSV export for the full inventory.`,
      inputSchema: s.object("The Prism inventory request.", {
        maxResults: s.integer(
          "The maximum inventory rows to return; defaults to 20 for high-volume categories and 50 for others.",
          { minimum: 1, maximum: 10000 },
        ),
        offset: s.nonNegativeInteger("Resume at this offset."),
        fields: s.array("Project inventory rows onto these field names.", s.string()),
        summary: s.boolean("Return per-device row counts and a sample instead of all rows."),
      }),
      outputSchema: prismOutput,
    }),
  ),
  defineProviderAction("kandji", {
    name: "prism_count",
    description:
      "Read the full inventory row count for every Prism category. Failed categories retain a null count and an error.",
    inputSchema: s.object({}),
    outputSchema: s.requiredObject("Counts and any category-specific failures.", {
      counts: s.record(s.nullableInteger("The category's total row count.")),
      errors: s.record(s.string()),
    }),
  }),
  defineProviderAction("kandji", {
    name: "prism_request_export",
    description:
      "Start a CSV export for a Prism inventory category. Poll prism_get_export for its completion and download URL.",
    inputSchema: s.object(
      "The export scope.",
      {
        category: s.stringEnum(prismCategories),
        device_families: s.array(s.stringEnum(["Mac", "iPhone", "iPad", "AppleTV", "VisionPro"]), { minItems: 1 }),
        blueprint_ids: s.array(s.string(), { default: ["*"] }),
        filters: s.looseObject(
          "Additional export filters; category, device_families and blueprint_ids must use their dedicated parameters.",
        ),
      },
      { required: ["category", "device_families"] },
    ),
    outputSchema: s.looseObject("The created export job."),
    asyncLifecycle: exportLifecycle,
  }),
  defineProviderAction("kandji", {
    name: "prism_get_export",
    description: "Read a Prism export job's status and download location.",
    inputSchema: s.requiredObject("The export job.", { exportId: s.nonEmptyString("The export job ID.") }),
    outputSchema: s.looseObject("The job state and download location when ready."),
    asyncLifecycle: exportLifecycle,
  }),
];
