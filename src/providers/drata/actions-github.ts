import type { ActionDefinition } from "../../core/types.ts";

import { s } from "../../core/json-schema.ts";
import { defineProviderAction } from "../../core/provider-definition.ts";
const repository = {
  owner: s.string("The GitHub user or organisation. Defaults to a single connected GitHub organisation in Drata."),
  repo: s.nonEmptyString("The repository name."),
};
const paging = {
  maxResults: s.integer({ minimum: 1, maximum: 1000, default: 1000 }),
  page: s.positiveInteger("The GitHub continuation page."),
  after: s.string("The GitHub continuation cursor."),
};
export const drataGithubActions: ActionDefinition[] = [
  {
    name: "scan_github_repos",
    description:
      "List repository visibility, default branches and archive state using the separately stored githubToken.",
    inputSchema: s.object({ org: s.string(), ...paging }),
    outputSchema: s.looseObject("Repository scan results and continuation metadata."),
  },
  {
    name: "scan_github_branch_protection",
    description:
      "Inspect a repository branch's protection rules using githubToken. A specific unprotected-branch response is a finding; missing repository access remains an error.",
    inputSchema: s.object({ ...repository, branch: s.string() }, { required: ["repo"] }),
    outputSchema: s.looseObject("The branch protection settings."),
  },
  {
    name: "scan_github_collaborators",
    description: "List repository collaborators, roles and elevated permissions using githubToken.",
    inputSchema: s.object({ ...repository, ...paging }, { required: ["repo"] }),
    outputSchema: s.looseObject("Collaborators, elevated access count and continuation metadata."),
  },
  {
    name: "scan_github_vulnerabilities",
    description: "Read Dependabot alerts with severity counts using githubToken. Counts cover the returned alert set.",
    inputSchema: s.object(
      { ...repository, ...paging, state: s.stringEnum(["open", "fixed", "dismissed", "auto_dismissed"]) },
      { required: ["repo"] },
    ),
    outputSchema: s.looseObject("Vulnerability findings and continuation metadata."),
  },
].map((action) => defineProviderAction("drata", action));
