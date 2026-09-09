import type { KandjiActionContext } from "./runtime-request.ts";

import { describe, expect, it, vi } from "vitest";
import { kandjiActionHandlers } from "./runtime.ts";

function context(fetcher: typeof fetch): KandjiActionContext {
  return { apiKey: "test-token", apiUrl: "https://example.api.kandji.io", fetcher };
}

describe("Kandji management workflows", () => {
  it("keeps blueprint cloning and enrollment fields in the required form encoding", async () => {
    const fetcher = vi.fn<typeof fetch>(async () => Response.json({ id: "created" }));
    await kandjiActionHandlers.create_blueprint(
      { name: "Engineering", template_id: 3, enrollment_code: "123456" },
      context(fetcher),
    );
    const init = fetcher.mock.calls[0]![1] as RequestInit;
    const body = init.body as URLSearchParams;
    expect(new Headers(init.headers).get("content-type")).toBe("application/x-www-form-urlencoded");
    expect(Object.fromEntries(body)).toEqual({
      name: "Engineering",
      type: "map",
      "source.type": "template",
      "source.id": "3",
      "enrollment_code.is_active": "true",
      "enrollment_code.code": "123456",
    });
    expect(() =>
      kandjiActionHandlers.create_blueprint(
        { name: "Wrong source", source_type: "blueprint", template_id: 3 },
        context(fetcher),
      ),
    ).toThrow("both source_type and source_id");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("preserves explicit profile platform exclusions and uses multipart for the profile", async () => {
    const fetcher = vi.fn<typeof fetch>(async () => Response.json({ id: "profile" }));
    expect(() =>
      kandjiActionHandlers.create_custom_profile(
        { name: "Test", mobileconfig: "<plist/>", runs_on_mac: false },
        context(fetcher),
      ),
    ).toThrow("At least one device family");
    expect(fetcher).not.toHaveBeenCalled();
    await kandjiActionHandlers.create_custom_profile({ name: "Test", mobileconfig: "<plist/>" }, context(fetcher));
    const body = (fetcher.mock.calls[0]![1] as RequestInit).body as FormData;
    expect(body.get("runs_on_mac")).toBe("true");
    expect(await (body.get("file") as File).text()).toBe("<plist/>");
  });

  it("returns the generated wipe PIN and never retries a dispatched command", async () => {
    const fetcher = vi.fn<typeof fetch>(async () => Response.json({ command_id: "queued" }));
    const result = (await kandjiActionHandlers.erase_device({ deviceId: "device" }, context(fetcher))) as {
      PIN: string;
      queued: boolean;
    };
    expect(result.PIN).toMatch(/^\d{6}$/);
    expect(result.queued).toBe(true);
    expect(JSON.parse((fetcher.mock.calls[0]![1] as RequestInit).body as string).PIN).toBe(result.PIN);
    const failing = vi.fn<typeof fetch>(async () => {
      throw new TypeError("connection reset");
    });
    await expect(kandjiActionHandlers.erase_device({ deviceId: "device" }, context(failing))).rejects.toThrow(
      "Kandji request failed",
    );
    expect(failing).toHaveBeenCalledTimes(1);
  });

  it.each([
    { name: "erase_device", handler: kandjiActionHandlers.erase_device },
    { name: "get_device_details", handler: kandjiActionHandlers.get_device_details },
  ])("rejects dot-segment device identifiers in $name", async ({ handler }) => {
    const fetcher = vi.fn<typeof fetch>(async () => Response.json({}));
    await expect(handler({ deviceId: ".." }, context(fetcher))).rejects.toThrow("relative path segment");
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("keeps signed enrollment profile bytes intact in transit storage", async () => {
    const bytes = new Uint8Array([0x30, 0x82, 0xff, 0x00, 0x80]);
    const fetcher = vi.fn(
      async () => new Response(bytes, { headers: { "content-type": "application/x-apple-aspen-config" } }),
    );
    const create = vi.fn(async (file: File) => ({
      fileId: "file",
      downloadUrl: "/download/file",
      sizeBytes: file.size,
      name: file.name,
      mimeType: file.type,
    }));
    await kandjiActionHandlers.get_blueprint_ota_enrollment_profile(
      { blueprintId: "blueprint" },
      { ...context(fetcher), transitFiles: { maxBytes: 1024, create, read: vi.fn(), delete: vi.fn() } },
    );
    expect(new Uint8Array(await create.mock.calls[0]![0].arrayBuffer())).toEqual(bytes);
  });

  it("reports Prism slice truncation and unknown projected fields without inventing fleet totals", async () => {
    const fetcher = vi.fn<typeof fetch>(async () =>
      Response.json({
        data: [0, 1, 2].map((n) => ({ device_id: "device", serial_number: "serial", bundle_name: `app-${n}` })),
        total: null,
      }),
    );
    const result = await kandjiActionHandlers.prism_apps(
      { maxResults: 2, fields: ["bundle_name", "typo"] },
      context(fetcher),
    );
    expect(result).toMatchObject({
      returned: 2,
      totalAvailable: null,
      truncated: true,
      nextOffset: 2,
      devicesInSlice: 1,
      fieldsUnknown: ["typo"],
      devices: { device: { serial_number: "serial" } },
      rows: [
        { device_id: "device", bundle_name: "app-0" },
        { device_id: "device", bundle_name: "app-1" },
      ],
    });
  });

  it("refuses filters that would silently widen an export scope", async () => {
    const fetcher = vi.fn<typeof fetch>(async () => Response.json({}));
    expect(() =>
      kandjiActionHandlers.prism_request_export(
        { category: "apps", device_families: ["Mac"], filters: { blueprint_ids: ["private"] } },
        context(fetcher),
      ),
    ).toThrow("dedicated export parameters");
    expect(fetcher).not.toHaveBeenCalled();
  });
});

it("continues Prism pages when Kandji silently clamps the requested limit", async () => {
  const rows = Array.from({ length: 200 }, (_, n) => ({ device_id: `device-${n}`, bundle_name: `app-${n}` }));
  const fetcher = vi.fn<typeof fetch>(async (input) => {
    const offset = Number(new URL(String(input)).searchParams.get("offset"));
    return Response.json({ data: rows.slice(offset, offset + 100) });
  });
  const result = await kandjiActionHandlers.prism_apps({ maxResults: 250 }, context(fetcher));
  expect(result).toMatchObject({ returned: 200, truncated: false, nextOffset: null });
  expect(fetcher.mock.calls.map(([url]) => new URL(String(url)).searchParams.get("offset"))).toEqual([
    "0",
    "100",
    "200",
  ]);
});
