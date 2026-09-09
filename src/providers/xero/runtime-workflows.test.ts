import type { OAuthProviderContext, ProviderFetch } from "../provider-runtime.ts";

import { describe, expect, it, vi } from "vitest";
import { xeroActionHandlers } from "./executors.ts";

const tenant = "11111111-1111-4111-8111-111111111111";
const id = "22222222-2222-4222-8222-222222222222";
const otherId = "33333333-3333-4333-8333-333333333333";
interface Request {
  url: URL;
  method: string;
  headers: Headers;
  body: unknown;
}
function connection(respond: (request: Request) => unknown): { context: OAuthProviderContext; requests: Request[] } {
  const requests: Request[] = [];
  const fetcher: ProviderFetch = async (url, init) => {
    const body = init?.body;
    const request = {
      url: new URL(String(url)),
      method: init?.method ?? "GET",
      headers: new Headers(init?.headers),
      body: typeof body === "string" ? JSON.parse(body) : body,
    };
    requests.push(request);
    const response = respond(request);
    return response instanceof Response ? response : Response.json(response);
  };
  return { context: { accessToken: "xero-token", fetcher }, requests };
}

describe("Xero accounting workflows", () => {
  it("requires explicit tenant selection for a multi-organisation token", async () => {
    const { context, requests } = connection(() => [{ tenantId: tenant }, { tenantId: id }]);
    await expect(xeroActionHandlers.create_contact({ name: "Example" }, context)).rejects.toMatchObject({
      status: 400,
      message: expect.stringContaining("multiple"),
    });
    expect(requests.map((request) => request.url.pathname)).toEqual(["/connections"]);
  });

  it("retains item, tax, tracking, independent supplier number and reference on an invoice", async () => {
    const { context, requests } = connection(() => ({
      Invoices: [{ InvoiceID: id, Warnings: [{ Message: "Check currency rate" }] }],
    }));
    const result = await xeroActionHandlers.create_invoice(
      {
        tenant_id: tenant,
        type: "ACCPAY",
        contact_id: id,
        invoice_number: "SUP-42",
        reference: "PO-5",
        currency_code: "EUR",
        idempotency_key: "invoice-once",
        line_items: [
          {
            description: "Service",
            quantity: 1,
            unit_amount: 25,
            item_code: "SERVICE",
            tax_type: "INPUT2",
            tracking: [{ tracking_category_id: id, tracking_option_id: otherId }],
          },
        ],
      },
      context,
    );
    expect(requests[0]).toMatchObject({
      method: "PUT",
      body: {
        Invoices: [
          {
            Type: "ACCPAY",
            InvoiceNumber: "SUP-42",
            Reference: "PO-5",
            CurrencyCode: "EUR",
            LineItems: [
              {
                ItemCode: "SERVICE",
                TaxType: "INPUT2",
                Tracking: [{ TrackingCategoryID: id, TrackingOptionID: otherId }],
              },
            ],
          },
        ],
      },
    });
    expect(requests[0].headers.get("idempotency-key")).toBe("invoice-once");
    expect(result).toMatchObject({ invoice: { warnings: [{ Message: "Check currency rate" }] } });
  });

  it("rejects paid invoice financial edits before sending a mutation", async () => {
    const { context, requests } = connection(() => ({ Invoices: [{ InvoiceID: id, Status: "PAID" }] }));
    await expect(
      xeroActionHandlers.update_invoice({ tenant_id: tenant, invoice_id: id, reference: "Change" }, context),
    ).rejects.toMatchObject({ status: 400 });
    expect(requests.map((request) => request.method)).toEqual(["GET"]);
  });

  it("updates only writable bank fields and retains supplied line identity", async () => {
    const { context, requests } = connection((request) => ({
      BankTransactions:
        request.method === "GET"
          ? [{ Status: "AUTHORISED", IsReconciled: false, Total: 999, UpdatedDateUTC: "read-only" }]
          : [],
    }));
    await xeroActionHandlers.update_bank_transaction(
      {
        tenant_id: tenant,
        bank_transaction_id: id,
        reference: "Updated",
        line_items: [
          { line_item_id: otherId, description: "Service", quantity: 1, unit_amount: 20, account_code: "400" },
        ],
      },
      context,
    );
    expect(requests[1].body).toEqual({
      BankTransactions: [
        {
          BankTransactionID: id,
          Reference: "Updated",
          LineItems: [{ LineItemID: otherId, Description: "Service", Quantity: 1, UnitAmount: 20, AccountCode: "400" }],
        },
      ],
    });
  });

  it.each([
    [10, -9],
    [0.12345, -0.12345],
  ])("rejects unbalanced or over-precision journals (%s, %s)", async (debit, credit) => {
    const { context, requests } = connection(() => ({}));
    await expect(
      xeroActionHandlers.create_manual_journal(
        {
          tenant_id: tenant,
          narration: "Accrual",
          journal_lines: [
            { account_code: "400", line_amount: debit },
            { account_code: "200", line_amount: credit },
          ],
        },
        context,
      ),
    ).rejects.toMatchObject({ status: 400 });
    expect(requests).toHaveLength(0);
  });

  it("accepts balanced four-decimal journal amounts without floating-point drift", async () => {
    const { context, requests } = connection(() => ({ ManualJournals: [{ ManualJournalID: id }] }));
    await xeroActionHandlers.create_manual_journal(
      {
        tenant_id: tenant,
        narration: "Accrual",
        journal_lines: [
          { account_code: "400", line_amount: 0.1 },
          { account_code: "400", line_amount: 0.2 },
          { account_code: "200", line_amount: -0.3 },
        ],
      },
      context,
    );
    expect(requests[0]).toMatchObject({
      method: "PUT",
      body: {
        ManualJournals: [
          {
            Narration: "Accrual",
            Status: "DRAFT",
            JournalLines: [{ LineAmount: 0.1 }, { LineAmount: 0.2 }, { LineAmount: -0.3 }],
          },
        ],
      },
    });
  });

  it("rejects an overpayment before writing", async () => {
    const { context, requests } = connection(() => ({ Invoices: [{ Status: "AUTHORISED", AmountDue: 20 }] }));
    await expect(
      xeroActionHandlers.create_payment(
        { tenant_id: tenant, invoice_id: id, account_id: otherId, amount: 21, date: "2026-09-09" },
        context,
      ),
    ).rejects.toMatchObject({ status: 400 });
    expect(requests.map((request) => request.method)).toEqual(["GET"]);
  });

  it("compares payment Amount in invoice currency and forwards BankAmount independently", async () => {
    const { context, requests } = connection((request) =>
      request.method === "GET"
        ? { Invoices: [{ Status: "AUTHORISED", AmountDue: 20 }] }
        : { Payments: [{ PaymentID: id }] },
    );
    await xeroActionHandlers.create_payment(
      { tenant_id: tenant, invoice_id: id, account_id: otherId, amount: 20, bank_amount: 2000, date: "2026-09-09" },
      context,
    );
    expect(requests[1].body).toMatchObject({ Payments: [{ Amount: 20, BankAmount: 2000 }] });
  });

  it("reports partial batch failure and preserves warnings even on HTTP 200", async () => {
    const { context, requests } = connection(() => ({
      Contacts: [
        { ContactID: id, Warnings: [{ Message: "Possible duplicate" }] },
        { HasValidationErrors: true, ValidationErrors: [{ Message: "Name already exists" }] },
      ],
    }));
    const result = await xeroActionHandlers.batch_create_contacts(
      { tenant_id: tenant, contacts: [{ name: "One" }, { name: "Two" }] },
      context,
    );
    expect(requests[0].url.searchParams.get("summarizeErrors")).toBe("false");
    expect(result).toMatchObject({
      succeeded: 1,
      failed: 1,
      results: [
        { index: 0, success: true, warnings: [{ Message: "Possible duplicate" }] },
        { index: 1, success: false, validation_errors: [{ Message: "Name already exists" }] },
      ],
    });
  });

  it("surfaces nested provider validation errors without retrying a mutation", async () => {
    const { context, requests } = connection(() =>
      Response.json(
        { Message: "Validation failed", Elements: [{ ValidationErrors: [{ Message: "Account code is invalid" }] }] },
        { status: 400 },
      ),
    );
    await expect(
      xeroActionHandlers.create_account({ tenant_id: tenant, code: "BAD", name: "Example", type: "EXPENSE" }, context),
    ).rejects.toMatchObject({ status: 400, message: "Validation failed: Account code is invalid" });
    expect(requests).toHaveLength(1);
  });
});

describe("Xero API boundaries", () => {
  it("sends explicit project currencies and rates without inventing a GBP default", async () => {
    const { context, requests } = connection(() => ({ taskId: otherId }));
    await xeroActionHandlers.create_project_task(
      {
        tenant_id: tenant,
        project_id: id,
        name: "Consulting",
        rate: { currency: "NZD", value: 125 },
        charge_type: "TIME",
      },
      context,
    );
    expect(requests[0].url.pathname).toBe(`/projects.xro/2.0/Projects/${id}/Tasks`);
    expect(requests[0].body).toMatchObject({ rate: { currency: "NZD", value: 125 } });
  });

  it("copies only writable depreciation defaults from the selected asset type", async () => {
    const { context, requests } = connection((request) =>
      request.method === "GET"
        ? [
            {
              assetTypeId: id,
              bookDepreciationSetting: {
                depreciationMethod: "StraightLine",
                averagingMethod: "ActualDays",
                depreciationCalculationMethod: "Rate",
                depreciationRate: 25,
                bookDepreciationSettingId: "read-only",
              },
            },
          ]
        : { assetId: otherId },
    );
    await xeroActionHandlers.create_asset(
      {
        tenant_id: tenant,
        asset_type_id: id,
        asset_name: "Laptop",
        asset_number: "FA-1",
        purchase_price: 1000,
        purchase_date: "2026-09-09",
      },
      context,
    );
    expect(requests[1].url.pathname).toBe("/assets.xro/1.0/Assets");
    expect(requests[1].body).toMatchObject({
      bookDepreciationSetting: {
        depreciationMethod: "StraightLine",
        averagingMethod: "ActualDays",
        depreciationCalculationMethod: "Rate",
        depreciationRate: 25,
      },
    });
    expect(requests[1].body).not.toHaveProperty("bookDepreciationSetting.bookDepreciationSettingId");
  });

  it("rejects a UK tenant before calling the NZ payroll API", async () => {
    const { context, requests } = connection(() => ({ Organisations: [{ Version: "UK" }] }));
    await expect(xeroActionHandlers.list_timesheets({ tenant_id: tenant }, context)).rejects.toMatchObject({
      status: 400,
      message: expect.stringContaining("New Zealand"),
    });
    expect(requests).toHaveLength(1);
    expect(requests[0].url.pathname).toBe("/api.xro/2.0/Organisation");
  });

  it("uses the NZ payroll field casing and preserves tracking identity", async () => {
    const { context, requests } = connection((request) =>
      request.method === "GET" ? { Organisations: [{ Version: "NZ" }] } : { timesheet: {} },
    );
    await xeroActionHandlers.create_timesheet(
      {
        tenant_id: tenant,
        employee_id: id,
        payroll_calendar_id: otherId,
        start_date: "2026-09-01",
        end_date: "2026-09-07",
        timesheet_lines: [{ date: "2026-09-01", earnings_rate_id: id, tracking_item_id: otherId, number_of_units: 8 }],
      },
      context,
    );
    expect(requests[1].body).toEqual({
      employeeID: id,
      payrollCalendarID: otherId,
      startDate: "2026-09-01",
      endDate: "2026-09-07",
      timesheetLines: [{ date: "2026-09-01", earningsRateID: id, trackingItemID: otherId, numberOfUnits: 8 }],
    });
  });

  it("uploads Files multipart bytes under the filename field used by Xero", async () => {
    const file = new File([new Uint8Array([0, 255, 13, 10])], "evidence.pdf", { type: "application/pdf" });
    const { context, requests } = connection(() => ({ Id: id }));
    context.transitFiles = {
      maxBytes: 1024,
      create: vi.fn(),
      read: vi
        .fn()
        .mockResolvedValue({ file, name: file.name, mimeType: file.type, sizeBytes: file.size, fileId: "transit-1" }),
      delete: vi.fn(),
    };
    await xeroActionHandlers.upload_file({ tenant_id: tenant, file: { fileId: "transit-1" } }, context);
    expect(requests[0].url.pathname).toBe("/files.xro/1.0/Files");
    expect(requests[0].headers.has("content-type")).toBe(false);
    const body = requests[0].body as FormData;
    expect(body.get("name")).toBe("evidence.pdf");
    expect(new Uint8Array(await (body.get("evidence.pdf") as File).arrayBuffer())).toEqual(
      new Uint8Array([0, 255, 13, 10]),
    );
  });

  it("downloads exact PDF bytes into transit storage", async () => {
    const bytes = new Uint8Array([37, 80, 68, 70, 0, 255]);
    const { context, requests } = connection(
      () => new Response(bytes, { headers: { "content-type": "application/pdf" } }),
    );
    const create = vi.fn().mockResolvedValue({ fileId: "download-1" });
    context.transitFiles = { maxBytes: 1024, create, read: vi.fn(), delete: vi.fn() };
    await expect(
      xeroActionHandlers.download_document_pdf({ tenant_id: tenant, entity_type: "Invoices", entity_id: id }, context),
    ).resolves.toEqual({ fileId: "download-1" });
    expect(requests[0].headers.get("accept")).toBe("application/pdf");
    expect(new Uint8Array(await (create.mock.calls[0][0] as File).arrayBuffer())).toEqual(bytes);
  });

  it("rejects attachment path traversal before provider egress", async () => {
    const { context, requests } = connection(() => ({}));
    await expect(
      xeroActionHandlers.download_attachment(
        { tenant_id: tenant, entity_type: "Invoices", entity_id: id, file_name: ".." },
        context,
      ),
    ).rejects.toMatchObject({ status: 400 });
    expect(requests).toHaveLength(0);
  });
});

it("preserves prior tracking-option writes and stops after an uncertain server failure", async () => {
  const { context, requests } = connection((request) =>
    (request.body as { Name: string }).Name === "Two"
      ? Response.json({ Message: "Unavailable" }, { status: 503 })
      : { Options: [{ TrackingOptionID: id }] },
  );
  const result = await xeroActionHandlers.update_tracking_options(
    {
      tenant_id: tenant,
      tracking_category_id: id,
      idempotency_key: "x".repeat(128),
      options: [
        { tracking_option_id: id, name: "One" },
        { tracking_option_id: otherId, name: "Two" },
        { tracking_option_id: tenant, name: "Three" },
      ],
    },
    context,
  );
  expect(result).toMatchObject({
    attempted: 2,
    not_attempted: 1,
    complete: false,
    results: [
      { index: 0, success: true },
      { index: 1, success: false, outcomeUnknown: true },
    ],
  });
  expect(requests).toHaveLength(2);
  expect(requests[0].headers.get("idempotency-key")).toHaveLength(64);
  expect(requests[1].headers.get("idempotency-key")).not.toBe(requests[0].headers.get("idempotency-key"));
});

it("serializes folder names as the official Files SDK does", async () => {
  const { context, requests } = connection(() => ({ Id: id, Name: "Evidence" }));
  await xeroActionHandlers.create_folder({ tenant_id: tenant, name: "Evidence" }, context);
  expect(requests[0].url.pathname).toBe("/files.xro/1.0/Folders");
  expect(requests[0].body).toEqual({ Name: "Evidence" });
});
