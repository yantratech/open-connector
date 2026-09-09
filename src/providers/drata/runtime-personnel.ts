import type { ProviderActionHandlerSubset, ProviderRuntimeHandler } from "../provider-runtime.ts";
import type { DrataActionContext } from "./runtime-request.ts";

import { compactObject, looseArray, optionalRecord, optionalString, recordOrEmpty } from "../../core/cast.ts";
import { providerInputError, providerResponseError } from "../provider-runtime.ts";
import { readDrataLegacyList } from "./runtime-legacy.ts";
import { drataPathId, readDrataList, requestDrataJson } from "./runtime-request.ts";

export const drataPersonnelHandlers: ProviderActionHandlerSubset<
  "drata",
  ProviderRuntimeHandler<DrataActionContext>
> = {
  async list_personnel_v2(input, context) {
    const result = await readDrataLegacyList(context, "/personnel", { ...input, fetchAll: true });
    const q = optionalString(input.q)?.toLowerCase();
    const rows = result.data
      .map((value) => personnelRecord(value, input.fields))
      .filter((row) => !q || [row.email, row.firstName, row.lastName].join(" ").toLowerCase().includes(q));
    return { ...result, returned: rows.length, data: rows, complete: result.pagination.nextPage === null };
  },
  async update_personnel(input, context) {
    const body = compactObject({
      firstName: input.firstName,
      lastName: input.lastName,
      jobTitle: input.jobTitle,
      email: input.email,
    });
    if (!Object.keys(body).length) throw providerInputError("Provide at least one personnel field to change.");
    const identity = await resolvePersonnel(input, context, false);
    return requestDrataJson({
      ...context,
      path: `/personnel/${drataPathId(identity.personnelId, "personnelId")}`,
      method: "PUT",
      body,
      mode: "execute",
    });
  },
  async create_background_check(input, context) {
    const identity = await resolvePersonnel(input, context, true);
    return requestDrataJson({
      ...context,
      path: "/background-checks",
      method: "POST",
      body: { userId: identity.userId, url: input.url, filedAt: input.filedAt },
      mode: "execute",
    });
  },
  async list_personnel_devices(input, context) {
    const identity = await resolvePersonnel(input, context, false);
    return readDrataList(context, `/personnel/${drataPathId(identity.personnelId, "personnelId")}/devices`, input, [
      "externalId",
      "macAddress",
      "serialNumber",
      "sourceType",
    ]);
  },
};

/** Compact the authoritative V1 user details and compliance checks while keeping personnel/user IDs separate. */
export function personnelRecord(value: unknown, fields?: unknown): Record<string, unknown> {
  const person = recordOrEmpty(value);
  const user = recordOrEmpty(person.user);
  const checks = looseArray(person.complianceChecks).map(recordOrEmpty);
  const fullStatus = checks.find((check) => check.type === "FULL_COMPLIANCE")?.status;
  const documents = looseArray(user.documents ?? person.documents);
  const backgroundChecks = looseArray(user.backgroundChecks ?? person.backgroundChecks);
  const selected = looseArray(fields);
  return {
    id: person.id,
    userId: user.id ?? person.userId ?? null,
    firstName: user.firstName ?? null,
    lastName: user.lastName ?? null,
    email: user.email ?? null,
    jobTitle: user.jobTitle ?? null,
    employmentStatus: person.employmentStatus ?? "UNKNOWN",
    roles: user.roles ?? person.roles ?? [],
    devicesCount: person.devicesCount ?? null,
    isCompliant: fullStatus === "PASS" ? true : fullStatus === "FAIL" ? false : null,
    failedChecks: checks
      .filter((check) => check.status === "FAIL" && check.type !== "FULL_COMPLIANCE")
      .map((check) => check.type),
    excludedChecks: checks.filter((check) => check.status === "EXCLUDED").map((check) => check.type),
    backgroundChecksCount: backgroundChecks.length,
    documentsCount: documents.length,
    backgroundChecks: selected.includes("backgroundChecks") ? backgroundChecks : undefined,
    documents: selected.includes("documents") ? documents : undefined,
    complianceChecks: selected.includes("complianceChecks") ? checks : undefined,
  };
}

interface PersonnelIdentity {
  personnelId?: unknown;
  userId?: unknown;
}
async function resolvePersonnel(
  input: Record<string, unknown>,
  context: DrataActionContext,
  needsUser: boolean,
): Promise<PersonnelIdentity> {
  const selectors = needsUser ? ["personnelId", "lookupEmail", "userId"] : ["personnelId", "lookupEmail"];
  if (selectors.filter((key) => input[key] !== undefined).length !== 1)
    throw providerInputError(`Provide exactly one of ${selectors.join(", ")}.`);
  if (needsUser && input.userId !== undefined) return { userId: input.userId };
  if (!needsUser && input.personnelId !== undefined) return { personnelId: input.personnelId };
  const directory = await readDrataLegacyList(context, "/personnel", { fetchAll: true });
  if (directory.pagination.nextPage !== null)
    throw providerResponseError(
      "The personnel lookup exceeded its record budget; supply the explicit user or personnel ID.",
    );
  const email = optionalString(input.lookupEmail)?.toLowerCase();
  const matches = directory.data
    .map(recordOrEmpty)
    .filter((row) =>
      email
        ? optionalString(optionalRecord(row.user)?.email)?.toLowerCase() === email
        : String(row.id) === String(input.personnelId),
    );
  if (matches.length !== 1) throw providerInputError("The personnel selector must match exactly one person.");
  const person = matches[0]!;
  const userId = optionalRecord(person.user)?.id;
  if (needsUser && userId === undefined)
    throw providerResponseError("Drata did not return a user ID for this personnel record.");
  return { personnelId: person.id, userId };
}
