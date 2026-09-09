import type { ProviderActionHandlerSubset, ProviderRuntimeHandler } from "../provider-runtime.ts";
import type { DrataActionContext } from "./runtime-request.ts";

import { optionalInteger, optionalRecord, optionalString, recordOrEmpty } from "../../core/cast.ts";
import { readBoundedResponseBytes } from "../../core/request.ts";
import {
  providerInputError,
  providerResponseError,
  ProviderRequestError,
  requiredInputString,
  runProviderRequest,
} from "../provider-runtime.ts";
import { readDrataLegacyList } from "./runtime-legacy.ts";
import { drataPathId } from "./runtime-request.ts";

export const drataGithubHandlers: ProviderActionHandlerSubset<"drata", ProviderRuntimeHandler<DrataActionContext>> = {
  async scan_github_repos(input, context) {
    const org = optionalString(input.org) ?? (await connectedOrg(context));
    const page = await githubList(context, org ? `/orgs/${drataPathId(org, "org")}/repos` : "/user/repos", input);
    return {
      ...page,
      org: org ?? null,
      orgSource: input.org ? "parameter" : org ? "drata-connection" : "authenticated-user",
      data: page.data.map((value) => {
        const row = recordOrEmpty(value);
        return {
          name: row.full_name,
          private: row.private,
          visibility: row.visibility,
          defaultBranch: row.default_branch,
          archived: row.archived,
          url: row.html_url,
        };
      }),
    };
  },
  async scan_github_branch_protection(input, context) {
    const path = await repositoryPath(input, context);
    let branch = optionalString(input.branch);
    if (!branch)
      branch = optionalString(recordOrEmpty((await githubRequest(context, path, {})).payload).default_branch);
    if (!branch) throw providerResponseError("GitHub did not return a default branch.");
    try {
      const result = recordOrEmpty(
        (await githubRequest(context, `${path}/branches/${drataPathId(branch, "branch")}/protection`, {})).payload,
      );
      return {
        repo: input.repo,
        branch,
        protected: true,
        requiredStatusChecks: result.required_status_checks,
        requiredPullRequestReviews: result.required_pull_request_reviews,
        enforceAdmins: result.enforce_admins,
        restrictions: result.restrictions,
        requiredSignatures: result.required_signatures,
        allowForcePushes: result.allow_force_pushes,
        allowDeletions: result.allow_deletions,
      };
    } catch (error) {
      if (error instanceof ProviderRequestError && error.status === 404 && /branch not protected/i.test(error.message))
        return { repo: input.repo, branch, protected: false };
      throw error;
    }
  },
  async scan_github_collaborators(input, context) {
    const path = await repositoryPath(input, context);
    const page = await githubList(context, `${path}/collaborators`, input);
    const collaborators = page.data.map((value) => {
      const row = recordOrEmpty(value);
      return { login: row.login, role: row.role_name, permissions: row.permissions };
    });
    return {
      ...page,
      data: collaborators,
      elevatedAccessCount: collaborators.filter(
        (row) => optionalRecord(row.permissions)?.admin === true || optionalRecord(row.permissions)?.maintain === true,
      ).length,
    };
  },
  async scan_github_vulnerabilities(input, context) {
    const path = await repositoryPath(input, context);
    const page = await githubList(context, `${path}/dependabot/alerts`, input);
    const severityCounts: Record<string, number> = {};
    const alerts = page.data.map((value) => {
      const row = recordOrEmpty(value),
        advisory = recordOrEmpty(row.security_advisory),
        vulnerability = recordOrEmpty(row.security_vulnerability),
        dependency = recordOrEmpty(row.dependency);
      const severity = optionalString(vulnerability.severity) ?? optionalString(advisory.severity) ?? "unknown";
      severityCounts[severity] = (severityCounts[severity] ?? 0) + 1;
      return {
        number: row.number,
        state: row.state,
        severity,
        summary: advisory.summary,
        package: vulnerability.package,
        manifestPath: dependency.manifest_path,
        vulnerableVersionRange: vulnerability.vulnerable_version_range,
        firstPatchedVersion: vulnerability.first_patched_version,
        createdAt: row.created_at,
        fixedAt: row.fixed_at,
        url: row.html_url,
      };
    });
    return { ...page, severityCounts, data: alerts };
  },
};

interface GithubResponse {
  payload: unknown;
  nextPage?: number;
  nextAfter?: string;
}
async function githubRequest(
  context: DrataActionContext,
  path: string,
  query: Record<string, string | undefined>,
): Promise<GithubResponse> {
  const token = requiredInputString(
    context.githubToken,
    "githubToken (a separate GitHub credential is required for repository scans)",
  );
  return runProviderRequest({ signal: context.signal, label: "GitHub" }, async (signal) => {
    const url = new URL(`https://api.github.com${path}`);
    for (const [key, value] of Object.entries(query)) if (value !== undefined) url.searchParams.set(key, value);
    const response = await context.fetcher(url, {
      headers: {
        authorization: `Bearer ${token}`,
        accept: "application/vnd.github+json",
        "user-agent": "OpenConnector",
        "x-github-api-version": "2022-11-28",
      },
      signal,
    });
    const bytes = await readBoundedResponseBytes(response, {
      maxBytes: 10 * 1024 * 1024,
      fieldName: "GitHub response",
      createError: providerResponseError,
    });
    let payload: unknown;
    try {
      payload = JSON.parse(new TextDecoder().decode(bytes));
    } catch {
      throw providerResponseError("GitHub returned invalid JSON.");
    }
    if (!response.ok)
      throw new ProviderRequestError(
        response.status,
        optionalString(optionalRecord(payload)?.message) ?? `GitHub returned ${response.status}`,
      );
    const link = response.headers
      .get("link")
      ?.split(",")
      .find((part) => /rel="next"/.test(part));
    const target = link?.match(/<([^>]+)>/)?.[1];
    if (!target) return { payload };
    const next = new URL(target);
    if (next.origin !== url.origin || next.pathname !== url.pathname)
      throw providerResponseError("GitHub returned an unexpected pagination target.");
    return {
      payload,
      nextPage: next.searchParams.has("page") ? Number(next.searchParams.get("page")) : undefined,
      nextAfter: next.searchParams.get("after") ?? undefined,
    };
  });
}
interface GithubPage {
  data: unknown[];
  returned: number;
  complete: boolean;
  nextPage: number | null;
  nextAfter: string | null;
}
async function githubList(
  context: DrataActionContext,
  path: string,
  input: Record<string, unknown>,
): Promise<GithubPage> {
  const max = optionalInteger(input.maxResults) ?? 1000;
  if (max < 1 || max > 1000) throw providerInputError("maxResults must be between 1 and 1000.");
  let page = optionalInteger(input.page) ?? 1,
    after = optionalString(input.after);
  const data: unknown[] = [];
  const seen = new Set<string>();
  let nextPage: number | null = null,
    nextAfter: string | null = null;
  do {
    const key = `${page}:${after ?? ""}`;
    if (seen.has(key)) throw providerResponseError("GitHub repeated a pagination cursor.");
    seen.add(key);
    const result = await githubRequest(context, path, {
      per_page: String(Math.min(100, max - data.length)),
      page: after ? undefined : String(page),
      after,
      state: optionalString(input.state),
    });
    if (!Array.isArray(result.payload)) throw providerResponseError("GitHub returned an invalid list.");
    if (result.payload.length > max - data.length)
      throw providerResponseError("GitHub exceeded the requested page size.");
    data.push(...result.payload);
    nextPage = result.nextPage ?? null;
    nextAfter = result.nextAfter ?? null;
    if (!result.payload.length || (!nextPage && !nextAfter) || data.length >= max) break;
    page = nextPage ?? page;
    after = nextAfter ?? undefined;
  } while (data.length < max);
  return { data, returned: data.length, complete: nextPage === null && nextAfter === null, nextPage, nextAfter };
}
async function connectedOrg(context: DrataActionContext): Promise<string | undefined> {
  try {
    const connections = await readDrataLegacyList(context, "/connections", { fetchAll: true });
    const orgs = new Set(
      connections.data
        .map(recordOrEmpty)
        .filter((row) => String(row.clientType).toUpperCase() === "GITHUB")
        .map((row) => optionalString(row.clientId))
        .filter((value): value is string => value !== undefined),
    );
    return orgs.size === 1 ? [...orgs][0] : undefined;
  } catch (error) {
    if (context.signal?.aborted) throw error;
    return undefined;
  }
}
async function repositoryPath(input: Record<string, unknown>, context: DrataActionContext): Promise<string> {
  const owner = optionalString(input.owner) ?? (await connectedOrg(context));
  if (!owner)
    throw providerInputError("Provide owner; no unambiguous GitHub organisation could be derived from Drata.");
  return `/repos/${drataPathId(owner, "owner")}/${drataPathId(input.repo, "repo")}`;
}
