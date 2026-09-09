import type { ActionDefinition } from "../../core/types.ts";

import { s } from "../../core/json-schema.ts";
import { defineProviderAction } from "../../core/provider-definition.ts";
import { kandjiDeviceActions } from "./actions-devices.ts";
import { kandjiFleetActions } from "./actions-fleet.ts";
import { kandjiLibraryActions } from "./actions-library.ts";
import { kandjiPrismActions } from "./actions-prism.ts";

const service = "kandji";

const cursorSchema = s.nonEmptyString("The opaque pagination cursor returned by a previous Kandji response.");
const uuidSchema = s.uuid("A Kandji UUID value.");
const nullableStringSchema = s.nullable(s.string("A string value returned by Kandji when present."));
const nullableIntegerSchema = s.nullable(s.integer("An integer value returned by Kandji when present."));
const nullableBooleanSchema = s.nullable(s.boolean("A boolean value returned by Kandji when present."));
const rawObjectSchema = s.looseObject("The raw Kandji API object.");
const deviceIdSchema = s.nonEmptyString("The Kandji device ID returned by list_devices.");
const cveIdSchema = s.string("The CVE identifier.", { pattern: "^CVE-[0-9]{4}-[0-9]+$" });
const limitSchema = s.integer("The number of records to return.", { minimum: 1, maximum: 300 });
const offsetSchema = s.nonNegativeInteger("The zero-based pagination offset.");
const vulnerabilityLicenseOutput = {
  license_gated: s.boolean("Whether Kandji Vulnerability Management is unavailable for this tenant."),
  note: s.string("A remediation note when the feature is unavailable."),
};

const paginationSchema = s.object("Pagination links returned by Kandji.", {
  next: s.nullable(s.string("The URL for the next page, or null when no next page exists.")),
  previous: s.nullable(s.string("The URL for the previous page, or null when no previous page exists.")),
});

const blueprintSchema = s.object("A normalized Kandji blueprint record.", {
  id: s.string("The blueprint ID."),
  name: s.string("The blueprint name."),
  type: nullableStringSchema,
  description: nullableStringSchema,
  computersCount: nullableIntegerSchema,
  raw: s.looseObject("The raw blueprint object returned by Kandji."),
});

const userSchema = s.object("A normalized Kandji directory user record.", {
  id: s.string("The user ID."),
  email: nullableStringSchema,
  name: nullableStringSchema,
  active: nullableBooleanSchema,
  archived: nullableBooleanSchema,
  deviceCount: nullableIntegerSchema,
  raw: s.looseObject("The raw user object returned by Kandji."),
});

export const kandjiActions: ActionDefinition[] = [
  ...kandjiDeviceActions,
  ...kandjiFleetActions,
  ...kandjiLibraryActions,
  ...kandjiPrismActions,
  defineProviderAction(service, {
    name: "list_blueprints",
    description: "List Kandji blueprints with optional ID, name, and pagination filters.",
    inputSchema: s.object(
      "The input payload for listing Kandji blueprints.",
      {
        id: uuidSchema,
        idIn: s.array("Blueprint IDs used to filter results.", uuidSchema, { minItems: 1 }),
        name: s.nonEmptyString("The blueprint name used to filter results."),
        limit: s.integer("The maximum number of blueprint records to return.", {
          minimum: 1,
          maximum: 300,
        }),
        offset: s.nonNegativeInteger("The zero-based offset used for Kandji blueprint pagination."),
      },
      { optional: ["id", "idIn", "name", "limit", "offset"] },
    ),
    outputSchema: s.object("The response returned when listing Kandji blueprints.", {
      count: nullableIntegerSchema,
      pagination: paginationSchema,
      blueprints: s.array("The blueprints returned by Kandji.", blueprintSchema),
    }),
  }),
  defineProviderAction(service, {
    name: "get_blueprint",
    description: "Get a Kandji blueprint by ID.",
    inputSchema: s.object("The input payload for getting a Kandji blueprint.", {
      blueprintId: s.uuid("The unique identifier of the Kandji blueprint to retrieve."),
    }),
    outputSchema: s.object("The response returned when getting a Kandji blueprint.", {
      blueprint: blueprintSchema,
    }),
  }),
  defineProviderAction(service, {
    name: "list_users",
    description: "List Kandji directory users with optional filters and cursor pagination.",
    inputSchema: s.object(
      "The input payload for listing Kandji users.",
      {
        email: s.nonEmptyString("Return users with email addresses containing this value."),
        id: uuidSchema,
        integrationId: uuidSchema,
        archived: s.boolean("Whether to return archived or non-archived users."),
        cursor: cursorSchema,
        sizePerPage: s.integer("The number of user records to return per page.", {
          minimum: 1,
          maximum: 300,
        }),
      },
      { optional: ["email", "id", "integrationId", "archived", "cursor", "sizePerPage"] },
    ),
    outputSchema: s.object("The response returned when listing Kandji users.", {
      pagination: paginationSchema,
      users: s.array("The users returned by Kandji.", userSchema),
    }),
  }),
  defineProviderAction(service, {
    name: "get_user",
    description: "Get a Kandji directory user by ID.",
    inputSchema: s.object("The input payload for getting a Kandji user.", {
      userId: s.uuid("The unique identifier of the Kandji directory user to retrieve."),
    }),
    outputSchema: s.object("The response returned when getting a Kandji user.", {
      user: userSchema,
    }),
  }),
  defineProviderAction(service, {
    name: "list_devices",
    description: "List devices enrolled in Kandji with bounded native pagination and common fleet filters.",
    inputSchema: s.object(
      "Filters and pagination for Kandji devices.",
      {
        platform: s.stringEnum("The exact Kandji platform label.", [
          "Mac",
          "iPhone",
          "iPad",
          "AppleTV",
          "VisionPro",
          "Windows",
        ]),
        blueprintId: uuidSchema,
        serialNumber: s.nonEmptyString("Filter by exact device serial number."),
        assetTag: s.nonEmptyString("Filter by exact asset tag."),
        userEmail: s.email("Filter by assigned user email."),
        filevaultEnabled: s.boolean("Filter by FileVault enabled state."),
        limit: limitSchema,
        offset: offsetSchema,
      },
      {
        optional: [
          "platform",
          "blueprintId",
          "serialNumber",
          "assetTag",
          "userEmail",
          "filevaultEnabled",
          "limit",
          "offset",
        ],
      },
    ),
    outputSchema: s.object("A page of Kandji devices.", {
      returned: s.nonNegativeInteger("The number of device rows returned."),
      total: nullableIntegerSchema,
      pagination: paginationSchema,
      devices: s.array("The devices returned by Kandji.", rawObjectSchema),
    }),
  }),
  defineProviderAction(service, {
    name: "get_device",
    description: "Get the Kandji summary record for one device.",
    inputSchema: s.object("The Kandji device lookup.", { deviceId: deviceIdSchema }),
    outputSchema: rawObjectSchema,
  }),
  defineProviderAction(service, {
    name: "get_device_details",
    description:
      "Get comprehensive Kandji hardware, MDM, activation-lock, FileVault, and agent details for one device.",
    inputSchema: s.object("The Kandji device-detail lookup.", { deviceId: deviceIdSchema }),
    outputSchema: rawObjectSchema,
  }),
  defineProviderAction(service, {
    name: "get_device_apps",
    description: "List installed applications reported by one Kandji device.",
    inputSchema: s.object("The Kandji device applications lookup.", { deviceId: deviceIdSchema }),
    outputSchema: s.object("Applications installed on the Kandji device.", {
      count: s.nonNegativeInteger("The number of applications returned."),
      apps: s.array("Installed application records.", rawObjectSchema),
    }),
  }),
  defineProviderAction(service, {
    name: "get_device_status",
    description:
      "Get a Kandji device's library-item and parameter compliance status. Status values use mixed case upstream.",
    inputSchema: s.object("The Kandji device status lookup.", { deviceId: deviceIdSchema }),
    outputSchema: rawObjectSchema,
  }),
  defineProviderAction(service, {
    name: "get_device_activity",
    description: "Get one bounded page of MDM commands, check-ins, installs, and state changes for a Kandji device.",
    inputSchema: s.object(
      "Pagination for Kandji device activity.",
      { deviceId: deviceIdSchema, limit: limitSchema, offset: offsetSchema },
      { optional: ["limit", "offset"] },
    ),
    outputSchema: s.object("A page of Kandji device activity.", {
      returned: s.nonNegativeInteger("The number of activity rows returned."),
      total: nullableIntegerSchema,
      pagination: paginationSchema,
      activity: s.array("Device activity rows.", rawObjectSchema),
    }),
  }),
  defineProviderAction(service, {
    name: "get_audit_events",
    description: "Get one bounded page of Kandji administrator audit events for compliance evidence and forensics.",
    inputSchema: s.object(
      "Filters and pagination for Kandji audit events.",
      {
        startDate: s.dateTime("Inclusive event start timestamp."),
        endDate: s.dateTime("Inclusive event end timestamp."),
        limit: limitSchema,
        offset: offsetSchema,
      },
      { optional: ["startDate", "endDate", "limit", "offset"] },
    ),
    outputSchema: s.object("A page of Kandji audit events.", {
      returned: s.nonNegativeInteger("The number of audit events returned."),
      total: nullableIntegerSchema,
      pagination: paginationSchema,
      events: s.array("Kandji audit events.", rawObjectSchema),
    }),
  }),
  defineProviderAction(service, {
    name: "list_vulnerabilities",
    description: "List CVEs detected by Kandji Vulnerability Management with page/size pagination.",
    inputSchema: s.object(
      "Filters and pagination for Kandji vulnerabilities.",
      {
        severity: s.stringEnum("Filter by CVSS severity band.", ["low", "medium", "high", "critical"]),
        page: s.positiveInteger("The one-based page number."),
        size: limitSchema,
      },
      { optional: ["severity", "page", "size"] },
    ),
    outputSchema: s.object("A page of Kandji vulnerabilities.", {
      returned: s.nonNegativeInteger("The number of vulnerability rows returned."),
      total: nullableIntegerSchema,
      page: nullableIntegerSchema,
      vulnerabilities: s.array("The vulnerabilities returned by Kandji.", rawObjectSchema),
      ...vulnerabilityLicenseOutput,
    }),
  }),
  defineProviderAction(service, {
    name: "get_vulnerability",
    description: "Get one CVE from Kandji Vulnerability Management.",
    inputSchema: s.object("The Kandji vulnerability lookup.", { cveId: cveIdSchema }),
    outputSchema: rawObjectSchema,
  }),
  defineProviderAction(service, {
    name: "get_vulnerability_devices",
    description: "List devices affected by one Kandji vulnerability.",
    inputSchema: s.object(
      "The vulnerability-device lookup and pagination.",
      { cveId: cveIdSchema, page: s.positiveInteger("The one-based page number."), size: limitSchema },
      { optional: ["page", "size"] },
    ),
    outputSchema: s.object("Devices affected by the vulnerability.", {
      returned: s.nonNegativeInteger("The number of device rows returned."),
      total: nullableIntegerSchema,
      page: nullableIntegerSchema,
      devices: s.array("Affected devices.", rawObjectSchema),
      ...vulnerabilityLicenseOutput,
    }),
  }),
  defineProviderAction(service, {
    name: "get_vulnerability_software",
    description: "List software affected by one Kandji vulnerability.",
    inputSchema: s.object(
      "The vulnerability-software lookup and pagination.",
      { cveId: cveIdSchema, page: s.positiveInteger("The one-based page number."), size: limitSchema },
      { optional: ["page", "size"] },
    ),
    outputSchema: s.object("Software affected by the vulnerability.", {
      returned: s.nonNegativeInteger("The number of software rows returned."),
      total: nullableIntegerSchema,
      page: nullableIntegerSchema,
      software: s.array("Affected software.", rawObjectSchema),
      ...vulnerabilityLicenseOutput,
    }),
  }),
  defineProviderAction(service, {
    name: "list_vulnerability_detections",
    description: "List Kandji vulnerability detections, optionally filtered by CVE or device.",
    inputSchema: s.object(
      "Filters and pagination for Kandji vulnerability detections.",
      {
        cveId: cveIdSchema,
        deviceId: deviceIdSchema,
        page: s.positiveInteger("The one-based page number."),
        size: limitSchema,
      },
      { optional: ["cveId", "deviceId", "page", "size"] },
    ),
    outputSchema: s.object("A page of Kandji vulnerability detections.", {
      returned: s.nonNegativeInteger("The number of detection rows returned."),
      total: nullableIntegerSchema,
      page: nullableIntegerSchema,
      detections: s.array("Vulnerability detections.", rawObjectSchema),
      ...vulnerabilityLicenseOutput,
    }),
  }),
];
