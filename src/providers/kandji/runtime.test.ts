import { describe, expect, it } from "vitest";
import { kandjiActionHandlers } from "./runtime.ts";

interface RecordedRequest {
  url: URL;
  headers: Headers;
}

function createFetcher(responses: Record<string, unknown>): {
  fetcher: typeof fetch;
  requests: RecordedRequest[];
} {
  const requests: RecordedRequest[] = [];
  const fetcher: typeof fetch = async (input, init) => {
    const url = new URL(String(input));
    requests.push({ url, headers: new Headers(init?.headers) });
    const payload = responses[url.pathname];
    if (payload === undefined) {
      return Response.json({ detail: `no route for ${url.pathname}` }, { status: 404 });
    }
    return Response.json(payload);
  };
  return { fetcher, requests };
}

const contextBase = {
  apiKey: "kandji-api-token",
  apiUrl: "https://tenant.api.kandji.io",
};

describe("Kandji device actions", () => {
  it("forwards bounded list filters and preserves raw device records", async () => {
    const devices = [{ device_id: "device-1", device_name: "Ada's Mac" }];
    const { fetcher, requests } = createFetcher({
      "/api/v1/devices": { count: 1, next: null, previous: null, results: devices },
    });

    await expect(
      kandjiActionHandlers.list_devices(
        { platform: "Mac", blueprintId: "blueprint-1", filevaultEnabled: true, limit: 25, offset: 50 },
        { ...contextBase, fetcher },
      ),
    ).resolves.toEqual({
      returned: 1,
      total: 1,
      pagination: { next: null, previous: null },
      devices,
    });

    expect(requests).toHaveLength(1);
    expect(requests[0].url.searchParams.get("platform")).toBe("Mac");
    expect(requests[0].url.searchParams.get("blueprint_id")).toBe("blueprint-1");
    expect(requests[0].url.searchParams.get("filevault_enabled")).toBe("true");
    expect(requests[0].url.searchParams.get("limit")).toBe("25");
    expect(requests[0].url.searchParams.get("offset")).toBe("50");
    expect(requests[0].headers.get("authorization")).toBe("Bearer kandji-api-token");
  });

  it("fills a generic hardware model name from the device summary", async () => {
    const { fetcher } = createFetcher({
      "/api/v1/devices/device-1": { device_id: "device-1", model: "MacBook Pro (14-inch, 2024)" },
      "/api/v1/devices/device-1/details": { hardware_overview: { model_name: "Mac" } },
    });

    await expect(
      kandjiActionHandlers.get_device_details({ deviceId: "device-1" }, { ...contextBase, fetcher }),
    ).resolves.toEqual({
      hardware_overview: {
        model_name: "MacBook Pro (14-inch, 2024)",
        model_name_raw: "Mac",
      },
    });
  });

  it("uses bounded defaults for administrator audit events", async () => {
    const { fetcher, requests } = createFetcher({
      "/api/v1/audit/events": { count: 0, next: null, previous: null, results: [] },
    });

    await kandjiActionHandlers.get_audit_events({}, { ...contextBase, fetcher });

    expect(requests[0].url.searchParams.get("limit")).toBe("50");
    expect(requests[0].url.searchParams.get("offset")).toBe("0");
  });

  it("reports an unavailable vulnerability-management license as data", async () => {
    const fetcher: typeof fetch = async () => Response.json({ detail: "not found" }, { status: 404 });

    await expect(kandjiActionHandlers.list_vulnerabilities({}, { ...contextBase, fetcher })).resolves.toMatchObject({
      returned: 0,
      vulnerabilities: [],
      license_gated: true,
      note: expect.stringMatching(/not enabled/i),
    });
  });
});
