import type { ProviderActionHandlerSubset, ProviderRuntimeHandler } from "../provider-runtime.ts";
import type { DrataActionContext } from "./runtime-request.ts";

import { looseArray, optionalRecord, optionalString, recordOrEmpty } from "../../core/cast.ts";
import { ProviderRequestError, providerResponseError, requiredInputString } from "../provider-runtime.ts";
import { drataPathId, drataQuery, readDrataList, requestDrataJson } from "./runtime-request.ts";

const policyStatuses: Record<number, string> = {
  1: "ACTIVE",
  2: "ARCHIVED",
  3: "REPLACED",
  4: "UNACCEPTABLE",
  5: "OUTDATED",
};

export const drataPolicyHandlers: ProviderActionHandlerSubset<"drata", ProviderRuntimeHandler<DrataActionContext>> = {
  list_policies_v2(input, context) {
    return readDrataList(context, "/policies", input, ["name", "statuses", "owners"]);
  },
  get_policy(input, context) {
    return requestDrataJson({
      ...context,
      path: policyPath(input),
      query: drataQuery(input, ["expand"]),
      mode: "execute",
    });
  },
  get_policy_approval_configuration(input, context) {
    return requestDrataJson({ ...context, path: `${policyPath(input)}/approval-configuration`, mode: "execute" });
  },
  async list_policy_versions(input, context) {
    const page = await readDrataList(context, `${policyPath(input)}/policy-versions`, input, [
      "version",
      "current",
      "statuses",
    ]);
    return { ...page, data: looseArray(page.data).map(normalizePolicyVersion) };
  },
  async get_policy_version(input, context) {
    return normalizePolicyVersion(
      await requestDrataJson({
        ...context,
        path: versionPath(input),
        query: drataQuery(input, ["expand"]),
        mode: "execute",
      }),
    );
  },
  async get_policy_version_content(input, context) {
    let content: Record<string, unknown>;
    try {
      content = recordOrEmpty(
        await requestDrataJson({ ...context, path: versionPath(input), responseType: "text", mode: "execute" }),
      );
    } catch (error) {
      if (!(error instanceof ProviderRequestError) || error.status !== 406) throw error;
      const result = recordOrEmpty(await requestDrataJson({ ...context, path: versionPath(input), mode: "execute" }));
      const html = optionalString(result.content);
      if (html === undefined) throw providerResponseError("Drata did not return HTML or a policy content field.");
      content = { content: html, contentType: "text/html" };
    }
    let metadata: unknown = null;
    let metadataError: string | null = null;
    try {
      metadata = normalizePolicyVersion(
        await requestDrataJson({ ...context, path: versionPath(input), mode: "execute" }),
      );
    } catch (error) {
      if (context.signal?.aborted) throw error;
      metadataError = error instanceof Error ? error.message : String(error);
    }
    return { policyId: input.policyId, policyVersionId: input.policyVersionId, metadata, metadataError, ...content };
  },
  list_policy_actions(input, context) {
    return readDrataList(context, `${policyPath(input)}/actions`, input);
  },
  perform_policy_action(input, context) {
    if (input.action === "RequestChanges") requiredInputString(input.reason, "reason");
    if (input.action === "OverrideApprove") requiredInputString(input.overrideReason, "overrideReason");
    return requestDrataJson({
      ...context,
      path: `${policyPath(input)}/actions`,
      method: "POST",
      body: { action: input.action, reason: input.reason, overrideReason: input.overrideReason },
      mode: "execute",
    });
  },
  async list_user_assigned_policies(input, context) {
    const page = await readDrataList(context, `/users/${drataPathId(input.userId, "userId")}/assigned-policies`, input);
    try {
      const directory = await readDrataList(context, "/policies", { fetchAll: true, maxResults: 10000 });
      const byId = new Map(
        looseArray(directory.data).map((value) => {
          const row = recordOrEmpty(value);
          return [String(row.id), row];
        }),
      );
      return {
        ...page,
        policyDirectoryComplete: !optionalRecord(directory.pagination)?.cursor,
        data: looseArray(page.data).map((value) => {
          const row = recordOrEmpty(value);
          const policy = byId.get(String(row.policyId ?? optionalRecord(row.policy)?.id));
          return {
            ...row,
            policyName: policy?.name ?? null,
            policyStatus: policy?.status ?? null,
            currentVersion:
              policy?.currentVersionId != null ? String(policy.currentVersionId) === String(row.policyVersionId) : null,
            currentPolicy: policy ?? null,
          };
        }),
      };
    } catch (error) {
      if (context.signal?.aborted) throw error;
      return {
        ...page,
        policyDirectoryComplete: false,
        note: "Current policy metadata is unavailable; an unaccepted assignment may refer to a superseded version.",
      };
    }
  },
  acknowledge_assigned_policy(input, context) {
    return requestDrataJson({
      ...context,
      path: `/users/${drataPathId(input.userId, "userId")}/assigned-policies/${drataPathId(input.policyId, "policyId")}/action-acknowledge`,
      method: "POST",
      body: { acceptedAt: input.acceptedAt, details: input.details },
      mode: "execute",
    });
  },
};

function policyPath(input: Record<string, unknown>): string {
  return `/policies/${drataPathId(input.policyId, "policyId")}`;
}
function versionPath(input: Record<string, unknown>): string {
  return `${policyPath(input)}/policy-versions/${drataPathId(input.policyVersionId, "policyVersionId")}`;
}
function normalizePolicyVersion(value: unknown): unknown {
  const version = optionalRecord(value);
  const policy = optionalRecord(version?.policy);
  const code = policy?.policyStatus;
  return version && policy && typeof code === "number" && policyStatuses[code]
    ? { ...version, policy: { ...policy, policyStatusCode: code, policyStatus: policyStatuses[code] } }
    : value;
}
