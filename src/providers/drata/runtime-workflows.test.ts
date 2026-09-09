import type { DrataActionContext } from "./runtime-request.ts";

import { describe, expect, it, vi } from "vitest";
import { readDrataList } from "./runtime-request.ts";
import { drataActionHandlers } from "./runtime.ts";

function context(fetcher: typeof fetch): DrataActionContext {
  return { apiKey: "drata-test-key", baseUrl: "https://public-api.drata.com/public/v2", fetcher };
}

describe("Drata workflow contracts", () => {
  it("uses V1 page/limit and top-level totals for legacy lists", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json({ data: [{ id: 1 }], page: 2, limit: 20, total: 45 }));
    const result = await drataActionHandlers.list_monitors({ page: 2, size: 20 }, context(fetcher));
    const url = new URL(String(fetcher.mock.calls[0]![0]));
    expect(url.pathname).toBe("/public/monitors");
    expect(url.searchParams.get("limit")).toBe("20");
    expect(url.searchParams.has("size")).toBe(false);
    expect(result).toMatchObject({ pagination: { page: 2, limit: 20, totalCount: 45 } });
  });
  it("retains the first cursor page's total when a budget stops the walk", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json({ data: [{ id: 1 }], pagination: { cursor: "a", totalCount: 9 } }))
      .mockResolvedValueOnce(Response.json({ data: [{ id: 2 }], pagination: { cursor: "b" } }));
    expect(await readDrataList(context(fetcher), "/users", { fetchAll: true, maxResults: 2, size: 1 })).toMatchObject({
      total: 9,
      returned: 2,
      pagination: { cursor: "b" },
    });
  });
  it("fails on empty continuing cursor pages instead of claiming completion", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json({ data: [], pagination: { cursor: "again" } }));
    await expect(readDrataList(context(fetcher), "/users", { fetchAll: true })).rejects.toThrow("empty page");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("creates controls as multipart and requires name, description and code", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ id: "7" }));
    await drataActionHandlers.create_control(
      { workspaceId: 1, name: "Access review", description: "Review access", code: "CUSTOM-1" },
      context(fetcher),
    );
    const request = fetcher.mock.calls[0]![1]!;
    expect(request.method).toBe("POST");
    expect(request.body).toBeInstanceOf(FormData);
    expect((request.body as FormData).get("code")).toBe("CUSTOM-1");
    expect(new Headers(request.headers).has("content-type")).toBe(false);
    expect(() =>
      drataActionHandlers.create_control({ workspaceId: 1, name: "Missing fields" }, context(fetcher)),
    ).toThrow("description");
  });
  it("resolves monitor IDs before requesting failures when namespaces collide", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        Response.json({
          data: [
            { id: 8, testId: 36, name: "Chosen" },
            { id: 205, testId: 8, name: "Different" },
          ],
          pagination: { cursor: null },
        }),
      )
      .mockResolvedValueOnce(Response.json({ data: [{ reason: "Actual failure" }], pagination: { cursor: null } }));
    const result = await drataActionHandlers.list_monitoring_test_failures(
      { workspaceId: 2, monitorId: 8 },
      context(fetcher),
    );
    expect(new URL(String(fetcher.mock.calls[1]![0])).pathname).toBe(
      "/public/v2/workspaces/2/monitoring-tests/36/failures",
    );
    expect(result).toMatchObject({ testId: 36, monitorId: 8, testName: "Chosen" });
  });
  it("preserves vendor fields through replacement PUT without replaying read-only fields", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        Response.json({
          id: 7,
          name: "Vendor",
          risk: "LOW",
          critical: true,
          notes: "old",
          createdAt: "old",
          documents: [{ id: 1 }],
        }),
      )
      .mockResolvedValueOnce(Response.json({ id: 7 }));
    await drataActionHandlers.update_vendor({ vendorId: 7, notes: "new" }, context(fetcher));
    expect(JSON.parse(String(fetcher.mock.calls[1]![1]!.body))).toEqual({
      name: "Vendor",
      risk: "LOW",
      critical: true,
      notes: "new",
    });
    expect(fetcher.mock.calls[1]![1]!.method).toBe("PUT");
  });
  it("preserves evidence renewal settings during metadata-only updates", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        Response.json({ name: "Template title", renewalScheduleType: "CUSTOM", renewalDate: "2027-01-01" }),
      )
      .mockResolvedValueOnce(Response.json({ id: 9 }));
    await drataActionHandlers.update_evidence_library_item(
      { workspaceId: 1, itemId: 9, ownerId: 11 },
      context(fetcher),
    );
    expect(JSON.parse(String(fetcher.mock.calls[1]![1]!.body))).toEqual({
      ownerId: 11,
      renewalScheduleType: "CUSTOM",
      renewalDate: "2027-01-01",
    });
  });
  it("uses the user identity for background checks after exact personnel email lookup", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        Response.json({ data: [{ id: 10, user: { id: 99, email: "PERSON@example.com" } }], total: 1 }),
      )
      .mockResolvedValueOnce(Response.json({ id: 3 }));
    await drataActionHandlers.create_background_check(
      { lookupEmail: "person@example.com", url: "https://checks.example.com/result/1" },
      context(fetcher),
    );
    expect(JSON.parse(String(fetcher.mock.calls[1]![1]!.body))).toMatchObject({ userId: 99 });
  });
  it("uses compliance rollups, keeps unknowns unknown and excludes former employees by default", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      Response.json({
        data: [
          {
            id: 1,
            employmentStatus: "CURRENT_EMPLOYEE",
            complianceChecks: [
              { type: "FULL_COMPLIANCE", status: "PASS" },
              { type: "HIPAA_TRAINING", status: "FAIL" },
              { type: "ACCEPTED_POLICIES", status: "EXCLUDED" },
            ],
          },
          { id: 2, employmentStatus: "CURRENT_CONTRACTOR", user: { drataTermsAgreedAt: "2026-01-01" } },
          {
            id: 3,
            employmentStatus: "FORMER_EMPLOYEE",
            complianceChecks: [{ type: "FULL_COMPLIANCE", status: "FAIL" }],
          },
        ],
        total: 3,
      }),
    );
    expect(await drataActionHandlers.check_personnel_compliance({}, context(fetcher))).toMatchObject({
      summary: {
        totalPersonnel: 3,
        scoredPersonnel: 2,
        compliantCount: 1,
        nonCompliantCount: 0,
        unknownComplianceCount: 1,
      },
      missingPolicyAck: [],
    });
  });
  it("annotates superseded policy assignments instead of treating every missing acknowledgment as current", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        Response.json({ data: [{ policyId: 4, policyVersionId: 9, acceptedAt: null }], pagination: { cursor: null } }),
      )
      .mockResolvedValueOnce(
        Response.json({
          data: [{ id: 4, name: "Policy", status: "ACTIVE", currentVersionId: 10 }],
          pagination: { cursor: null },
        }),
      );
    expect(await drataActionHandlers.list_user_assigned_policies({ userId: 2 }, context(fetcher))).toMatchObject({
      data: [{ currentVersion: false, policyStatus: "ACTIVE" }],
    });
  });
  it("does not send the Drata key to GitHub, and recognizes only the specific unprotected-branch error", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json({ message: "Branch not protected" }, { status: 404 }));
    const result = await drataActionHandlers.scan_github_branch_protection(
      { owner: "example", repo: "app", branch: "main" },
      { ...context(fetcher), githubToken: "github-test-key" },
    );
    expect(result).toMatchObject({ protected: false });
    expect(new Headers(fetcher.mock.calls[0]![1]!.headers).get("authorization")).toBe("Bearer github-test-key");
  });
});
