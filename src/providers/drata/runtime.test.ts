import { describe, expect, it } from "vitest";
import { drataActionHandlers, drataRegionBaseUrls } from "./runtime.ts";

interface RecordedRequest {
  url: URL;
  headers: Headers;
}

function createFetcher(response: unknown): { fetcher: typeof fetch; requests: RecordedRequest[] } {
  const requests: RecordedRequest[] = [];
  const fetcher: typeof fetch = async (input, init) => {
    requests.push({ url: new URL(String(input)), headers: new Headers(init?.headers) });
    return Response.json(response);
  };
  return { fetcher, requests };
}

const contextBase = {
  apiKey: "drata-api-token",
  baseUrl: drataRegionBaseUrls.us,
};

describe("Drata ported actions", () => {
  it("uses the legacy public route for assets and excludes removed records by default", async () => {
    const active = { id: 1, name: "Workstation", removedAt: null };
    const { fetcher, requests } = createFetcher({
      data: [active, { id: 2, name: "Old workstation", removedAt: "2026-01-01T00:00:00Z" }],
      pagination: { page: 2 },
    });

    const result = await drataActionHandlers.list_assets({ size: 25, page: 2 }, { ...contextBase, fetcher });

    expect(result).toMatchObject({ data: [active], pagination: { page: 2 }, raw: { data: [active] } });
    expect(requests[0].url.pathname).toBe("/public/assets");
    expect(requests[0].url.searchParams.get("size")).toBe("25");
    expect(requests[0].url.searchParams.get("page")).toBe("2");
    expect(requests[0].headers.get("authorization")).toBe("Bearer drata-api-token");
  });

  it("uses workspace-scoped v2 evidence routes and repeated status filters", async () => {
    const { fetcher, requests } = createFetcher({ data: [], pagination: {} });

    await drataActionHandlers.list_evidence_library(
      { workspaceId: 42, statuses: ["ACTIVE", "ARCHIVED"] },
      { ...contextBase, fetcher },
    );

    expect(requests[0].url.pathname).toBe("/public/v2/workspaces/42/evidence-library");
    expect(requests[0].url.searchParams.getAll("evidenceStatuses[]")).toEqual(["ACTIVE", "ARCHIVED"]);
    expect(requests[0].url.searchParams.get("size")).toBe("50");
    expect(requests[0].url.searchParams.get("includeTotalCount")).toBe("true");
  });

  it("bounds events newest-first and enforces the time cutoff on the returned page", async () => {
    const recent = { id: "recent", createdAt: "2026-08-25T12:00:00Z" };
    const { fetcher, requests } = createFetcher({
      data: [recent, { id: "old", createdAt: "2026-08-20T12:00:00Z" }],
      pagination: {},
    });

    const result = await drataActionHandlers.list_events(
      { since: "2026-08-24T00:00:00Z", sortDir: "desc" },
      { ...contextBase, fetcher },
    );

    expect(result).toMatchObject({ data: [recent], raw: { data: [recent] } });
    expect(requests[0].url.searchParams.get("size")).toBe("50");
    expect(requests[0].url.searchParams.get("sort")).toBe("createdAt");
    expect(requests[0].url.searchParams.get("sortDir")).toBe("DESC");
    expect(requests[0].url.searchParams.get("createdAtFrom")).toBe("2026-08-24T00:00:00Z");
  });
});
