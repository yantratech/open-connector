import type { ResolvedCredential } from "../../core/types.ts";
import type { ProviderFetch } from "../provider-runtime.ts";

import { describe, expect, it } from "vitest";
import { ProviderRequestError } from "../provider-runtime.ts";
import { credentialValidators, xeroActionHandlers } from "./executors.ts";

interface RecordedRequest {
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: unknown;
}

function createFetcher(routes: Record<string, unknown | ((request: RecordedRequest) => unknown)>): {
  fetcher: ProviderFetch;
  requests: RecordedRequest[];
} {
  const requests: RecordedRequest[] = [];
  const fetcher: ProviderFetch = async (input, init) => {
    const url = String(input);
    const request: RecordedRequest = {
      url,
      method: init?.method ?? "GET",
      headers: Object.fromEntries(new Headers(init?.headers).entries()),
    };
    if (init?.body) {
      request.body = JSON.parse(String(init.body));
    }
    requests.push(request);
    const pathname = url.split("?")[0];
    const route = routes[pathname];
    if (route === undefined) {
      return new Response(JSON.stringify({ error: `no route for ${pathname}` }), { status: 404 });
    }
    const payload = typeof route === "function" ? route(request) : route;
    return new Response(JSON.stringify(payload), { status: 200 });
  };
  return { fetcher, requests };
}

const accessToken = "test-access-token";
const oauthCredential: Extract<ResolvedCredential, { authType: "oauth2" }> = {
  authType: "oauth2",
  accessToken,
  tokenType: "Bearer",
  profile: { accountId: "oauth2", displayName: "OAuth Credential", grantedScopes: [] },
  metadata: {},
};
const connectionsFixture = [
  { tenantId: "11111111-1111-4111-8111-111111111111", tenantName: "Demo Company", tenantType: "ORG" },
];
const contactsFixture = [
  {
    ContactID: "22222222-2222-4222-8222-222222222222",
    Name: "Jane Doe",
    FirstName: "Jane",
    LastName: "Doe",
    EmailAddress: "jane@example.com",
    Phones: [{ PhoneNumber: "021 555 1234" }],
    IsCustomer: true,
    IsSupplier: false,
    AccountNumber: "AC-1001",
    ContactStatus: "ACTIVE",
  },
];
const invoiceFixture = {
  InvoiceID: "33333333-3333-4333-8333-333333333333",
  InvoiceNumber: "INV-0001",
  Type: "ACCREC",
  Status: "DRAFT",
  Date: "2026-08-01",
  DueDate: "2026-08-31",
  Reference: "Consulting work",
  Total: 1150,
  AmountDue: 1150,
  CurrencyCode: "NZD",
  Contact: { Name: "Jane Doe" },
  LineItems: [
    {
      LineItemID: "line-1",
      Description: "Consulting",
      Quantity: 2,
      UnitAmount: 500,
      LineAmount: 1000,
      AccountCode: "200",
    },
  ],
};

const userinfoFixture = {
  sub: "f7a1382e-c791-4cae-93be-1b912c6a7c6e",
  xero_userid: "f7a1382e-c791-4cae-93be-1b912c6a7c6e",
  name: "Ada Lovelace",
  preferred_username: "ada@example.com",
  email: "ada@example.com",
};

describe("credentialValidators", () => {
  it("accepts a valid identity when no organisation is connected", async () => {
    const { fetcher, requests } = createFetcher({
      "https://identity.xero.com/connect/userinfo": userinfoFixture,
      "https://api.xero.com/connections": [],
    });
    await expect(credentialValidators.oauth2!(oauthCredential, { fetcher })).resolves.toEqual({
      profile: { accountId: "f7a1382e-c791-4cae-93be-1b912c6a7c6e", displayName: "Ada Lovelace" },
      metadata: { validationEndpoint: "https://identity.xero.com/connect/userinfo" },
    });
    expect(requests.map((request) => request.url)).toEqual(["https://identity.xero.com/connect/userinfo"]);
  });

  it("rejects userinfo payloads that are missing an identity", async () => {
    const { fetcher } = createFetcher({
      "https://identity.xero.com/connect/userinfo": { name: "Ada Lovelace", email: "ada@example.com" },
    });
    await expect(credentialValidators.oauth2!(oauthCredential, { fetcher })).rejects.toEqual(
      new ProviderRequestError(502, "Xero userinfo response is missing sub"),
    );
  });

  it("rejects unauthorized userinfo responses", async () => {
    const fetcher: ProviderFetch = async () => Response.json({ error: "invalid_token" }, { status: 401 });
    await expect(credentialValidators.oauth2!(oauthCredential, { fetcher })).rejects.toMatchObject({
      status: 400,
      message: "invalid_token",
    });
  });
});

describe("list_organisations", () => {
  it("maps the identity connections to tenant summaries", async () => {
    const { fetcher, requests } = createFetcher({ "https://api.xero.com/connections": connectionsFixture });
    await expect(xeroActionHandlers.list_organisations({}, { accessToken, fetcher })).resolves.toEqual({
      organisations: [
        { tenant_id: "11111111-1111-4111-8111-111111111111", tenant_name: "Demo Company", tenant_type: "ORG" },
      ],
    });
    expect(requests[0].headers.authorization).toBe(`Bearer ${accessToken}`);
  });
});

describe("tenant resolution", () => {
  const baseRoutes = {
    "https://api.xero.com/connections": connectionsFixture,
    "https://api.xero.com/api.xro/2.0/Contacts": { Contacts: contactsFixture },
  };

  it("selects the only connection and sends the Xero-Tenant-Id header", async () => {
    const { fetcher, requests } = createFetcher(baseRoutes);
    await xeroActionHandlers.search_contacts({ search: "Jane" }, { accessToken, fetcher });
    const contactsRequest = requests.find((request) => request.url.includes("/Contacts"));
    expect(contactsRequest?.headers["xero-tenant-id"]).toBe("11111111-1111-4111-8111-111111111111");
    expect(new URL(contactsRequest?.url ?? "https://invalid.example").searchParams.get("searchTerm")).toBe("Jane");
  });

  it("sends quoted search terms through searchTerm instead of a where clause", async () => {
    const { fetcher, requests } = createFetcher(baseRoutes);
    await xeroActionHandlers.search_contacts(
      { tenant_id: "11111111-1111-4111-8111-111111111111", search: 'Acme "Holdings"' },
      { accessToken, fetcher },
    );
    const contactsRequest = requests.find((request) => request.url.includes("/Contacts"));
    const url = new URL(contactsRequest?.url ?? "https://invalid.example");
    expect(url.searchParams.get("searchTerm")).toBe('Acme "Holdings"');
    expect(url.searchParams.get("where")).toBeNull();
  });

  it("uses an explicit tenant_id without calling the connections endpoint", async () => {
    const { fetcher, requests } = createFetcher(baseRoutes);
    await xeroActionHandlers.search_contacts(
      { tenant_id: "99999999-9999-4999-8999-999999999999", page: 2 },
      { accessToken, fetcher },
    );
    expect(requests.some((request) => request.url.includes("/connections"))).toBe(false);
    const contactsRequest = requests.find((request) => request.url.includes("/Contacts"));
    expect(contactsRequest?.headers["xero-tenant-id"]).toBe("99999999-9999-4999-8999-999999999999");
    expect(contactsRequest?.url).toContain("page=2");
  });

  it("rejects with a stable error when no organisation is connected", async () => {
    const { fetcher } = createFetcher({ "https://api.xero.com/connections": [] });
    await expect(xeroActionHandlers.get_organisation({}, { accessToken, fetcher })).rejects.toMatchObject({
      status: 400,
    });
  });
});

describe("ported accounting reads", () => {
  it("lists payments with safe native filters and excludes deleted rows by default", async () => {
    const payments = [{ PaymentID: "payment-1", Status: "AUTHORISED", Amount: 120 }];
    const { fetcher, requests } = createFetcher({
      "https://api.xero.com/api.xro/2.0/Payments": { Payments: payments },
    });

    await expect(
      xeroActionHandlers.list_payments(
        {
          tenant_id: "11111111-1111-4111-8111-111111111111",
          invoice_number: 'INV-"42"',
          invoice_id: "11111111-1111-4111-8111-111111111111",
          page: 2,
          page_size: 25,
        },
        { accessToken, fetcher },
      ),
    ).resolves.toEqual({ items: payments, page: 2, returned: 1 });

    const request = requests[0];
    const url = new URL(request.url);
    expect(url.searchParams.get("where")).toBe(
      'Invoice.InvoiceNumber=="INV-\\"42\\"" AND Invoice.InvoiceID==guid("11111111-1111-4111-8111-111111111111") AND Status!="DELETED"',
    );
    expect(url.searchParams.get("page")).toBe("2");
    expect(url.searchParams.get("pageSize")).toBe("25");
    expect(request.headers["xero-tenant-id"]).toBe("11111111-1111-4111-8111-111111111111");
  });

  it("rejects an invalid payment filter GUID before making a request", async () => {
    const { fetcher, requests } = createFetcher({});

    await expect(
      xeroActionHandlers.list_payments(
        { tenant_id: "11111111-1111-4111-8111-111111111111", payment_id: '") OR Status!="DELETED"' },
        { accessToken, fetcher },
      ),
    ).rejects.toMatchObject({ status: 400, message: expect.stringMatching(/Xero UUID/) });
    expect(requests).toEqual([]);
  });

  it("omits the where parameter when deleted payments are explicitly included without filters", async () => {
    const { fetcher, requests } = createFetcher({
      "https://api.xero.com/api.xro/2.0/Payments": { Payments: [] },
    });

    await xeroActionHandlers.list_payments(
      { tenant_id: "11111111-1111-4111-8111-111111111111", include_deleted: true },
      { accessToken, fetcher },
    );

    expect(new URL(requests[0].url).searchParams.has("where")).toBe(false);
  });

  it("returns the last journal number as the next offset only for a full page", async () => {
    const journals = Array.from({ length: 100 }, (_, index) => ({
      JournalID: `journal-${index}`,
      JournalNumber: index + 1,
    }));
    const { fetcher, requests } = createFetcher({
      "https://api.xero.com/api.xro/2.0/Journals": { Journals: journals },
    });

    await expect(
      xeroActionHandlers.list_journals(
        { tenant_id: "11111111-1111-4111-8111-111111111111", offset: 10, payments_only: true },
        { accessToken, fetcher },
      ),
    ).resolves.toEqual({ items: journals, returned: 100, next_offset: 100 });
    const url = new URL(requests[0].url);
    expect(url.searchParams.get("offset")).toBe("10");
    expect(url.searchParams.get("paymentsOnly")).toBe("true");
  });
});

describe("get_contact", () => {
  it("maps the PascalCase Xero payload to the snake_case output", async () => {
    const { fetcher } = createFetcher({
      "https://api.xero.com/connections": connectionsFixture,
      "https://api.xero.com/api.xro/2.0/Contacts/22222222-2222-4222-8222-222222222222": { Contacts: contactsFixture },
    });
    await expect(
      xeroActionHandlers.get_contact(
        { tenant_id: "11111111-1111-4111-8111-111111111111", contact_id: "22222222-2222-4222-8222-222222222222" },
        { accessToken, fetcher },
      ),
    ).resolves.toMatchObject({
      contact_id: "22222222-2222-4222-8222-222222222222",
      name: "Jane Doe",
      first_name: "Jane",
      last_name: "Doe",
      email_address: "jane@example.com",
      phone: "021 555 1234",
      is_customer: true,
      is_supplier: false,
      account_number: "AC-1001",
      status: "ACTIVE",
    });
  });
});

describe("create_contact", () => {
  it("posts only writable Xero contact fields", async () => {
    const { fetcher, requests } = createFetcher({
      "https://api.xero.com/api.xro/2.0/Contacts": { Contacts: contactsFixture },
    });
    await xeroActionHandlers.create_contact(
      {
        tenant_id: "11111111-1111-4111-8111-111111111111",
        name: "Jane Doe",
        email_address: "jane@example.com",
        first_name: "Jane",
        last_name: "Doe",
      },
      { accessToken, fetcher },
    );
    const postRequest = requests.find((request) => request.method === "PUT");
    expect(postRequest?.body).toEqual({
      Contacts: [
        {
          Name: "Jane Doe",
          EmailAddress: "jane@example.com",
          FirstName: "Jane",
          LastName: "Doe",
        },
      ],
    });
  });
});

describe("create_invoice", () => {
  it("lets Xero determine both dates when the invoice date is omitted", async () => {
    const { fetcher, requests } = createFetcher({
      "https://api.xero.com/connections": connectionsFixture,
      "https://api.xero.com/api.xro/2.0/Invoices": { Invoices: [invoiceFixture] },
    });
    const result = await xeroActionHandlers.create_invoice(
      {
        tenant_id: "11111111-1111-4111-8111-111111111111",
        contact_id: "22222222-2222-4222-8222-222222222222",
        line_items: [{ description: "Consulting", quantity: 2, unit_amount: 500, account_code: "200" }],
      },
      { accessToken, fetcher },
    );
    const postRequest = requests.find((request) => request.method === "PUT");
    expect(postRequest?.body).toEqual({
      Invoices: [
        {
          Type: "ACCREC",
          Contact: { ContactID: "22222222-2222-4222-8222-222222222222" },
          Status: "DRAFT",
          LineItems: [{ Description: "Consulting", Quantity: 2, UnitAmount: 500, AccountCode: "200" }],
        },
      ],
    });
    expect(postRequest?.headers["xero-tenant-id"]).toBe("11111111-1111-4111-8111-111111111111");
    expect(result).toMatchObject({ invoice: { invoice_id: "33333333-3333-4333-8333-333333333333", total: 1150 } });
  });

  it("defaults the due date to 30 days after the invoice date", async () => {
    const { fetcher, requests } = createFetcher({
      "https://api.xero.com/connections": connectionsFixture,
      "https://api.xero.com/api.xro/2.0/Invoices": { Invoices: [invoiceFixture] },
    });
    await xeroActionHandlers.create_invoice(
      {
        tenant_id: "11111111-1111-4111-8111-111111111111",
        contact_id: "22222222-2222-4222-8222-222222222222",
        date: "2026-08-01",
        line_items: [{ description: "Consulting", quantity: 1, unit_amount: 100, account_code: "200" }],
      },
      { accessToken, fetcher },
    );
    const postRequest = requests.find((request) => request.method === "PUT");
    expect(postRequest?.body).toMatchObject({ Invoices: [{ DueDate: "2026-08-31" }] });
  });

  it("rejects when no line items are provided", async () => {
    const { fetcher } = createFetcher({
      "https://api.xero.com/connections": connectionsFixture,
    });
    await expect(
      xeroActionHandlers.create_invoice(
        {
          tenant_id: "11111111-1111-4111-8111-111111111111",
          contact_id: "22222222-2222-4222-8222-222222222222",
          line_items: [],
        },
        { accessToken, fetcher },
      ),
    ).rejects.toMatchObject({ status: 400 });
  });
});

describe("search_invoices", () => {
  it("forwards page and Statuses so Xero returns a paged invoice list", async () => {
    const { fetcher, requests } = createFetcher({
      "https://api.xero.com/connections": connectionsFixture,
      "https://api.xero.com/api.xro/2.0/Invoices": { Invoices: [invoiceFixture] },
    });
    const result = await xeroActionHandlers.search_invoices(
      { tenant_id: "11111111-1111-4111-8111-111111111111", status: "DRAFT", page: 2 },
      { accessToken, fetcher },
    );
    const invoicesRequest = requests.find((request) => request.url.includes("/Invoices"));
    expect(invoicesRequest?.url).toContain("page=2");
    expect(invoicesRequest?.url).toContain("Statuses=DRAFT");
    expect(result).toMatchObject({
      page: 2,
      returned: 1,
      items: [{ invoice_id: "33333333-3333-4333-8333-333333333333" }],
    });
  });
});

describe("search_bank_transactions", () => {
  it("normalises transaction, overpayment, and prepayment identifiers", async () => {
    const bankTransactions = [
      {
        BankTransactionID: "bank-1",
        Type: "RECEIVE-TRANSFER",
        Status: "DELETED",
        DateString: "2026-08-01",
        Total: 100,
        CurrencyCode: "NZD",
        Contact: { Name: "Transfer account" },
        LineItems: [],
      },
      {
        OverpaymentID: "overpayment-1",
        Type: "RECEIVE-OVERPAYMENT",
        Status: "PAID",
        DateString: "2026-08-02",
        Total: 200,
        CurrencyCode: "NZD",
        Contact: { Name: "Jane Doe" },
        LineItems: [],
      },
      {
        PrepaymentID: "prepayment-1",
        Type: "SPEND-PREPAYMENT",
        Status: "VOIDED",
        DateString: "2026-08-03",
        Total: 300,
        CurrencyCode: "NZD",
        Contact: { Name: "Supplier" },
        LineItems: [],
      },
    ];
    const { fetcher, requests } = createFetcher({
      "https://api.xero.com/api.xro/2.0/BankTransactions": { BankTransactions: bankTransactions },
    });
    const result = await xeroActionHandlers.search_bank_transactions(
      { tenant_id: "11111111-1111-4111-8111-111111111111", status: "PAID", page: 2 },
      { accessToken, fetcher },
    );
    const transactionRequest = requests.find((request) => request.url.includes("/BankTransactions"));
    const query = new URL(transactionRequest?.url ?? "https://invalid.example").searchParams;
    expect(query.get("where")).toBe('Status=="PAID"');
    expect(query.get("page")).toBe("2");
    expect(result).toEqual({
      items: [
        {
          transaction_id: "bank-1",
          type: "RECEIVE-TRANSFER",
          status: "DELETED",
          date: "2026-08-01",
          total: 100,
          currency_code: "NZD",
          contact_name: "Transfer account",
          line_item_count: 0,
        },
        {
          transaction_id: "overpayment-1",
          type: "RECEIVE-OVERPAYMENT",
          status: "PAID",
          date: "2026-08-02",
          total: 200,
          currency_code: "NZD",
          contact_name: "Jane Doe",
          line_item_count: 0,
        },
        {
          transaction_id: "prepayment-1",
          type: "SPEND-PREPAYMENT",
          status: "VOIDED",
          date: "2026-08-03",
          total: 300,
          currency_code: "NZD",
          contact_name: "Supplier",
          line_item_count: 0,
        },
      ],
      page: 2,
      returned: 3,
    });
  });

  it("rejects a Xero transaction without any supported identifier", async () => {
    const { fetcher } = createFetcher({
      "https://api.xero.com/api.xro/2.0/BankTransactions": {
        BankTransactions: [{ Type: "RECEIVE", Status: "AUTHORISED", LineItems: [] }],
      },
    });
    await expect(
      xeroActionHandlers.search_bank_transactions(
        { tenant_id: "11111111-1111-4111-8111-111111111111" },
        { accessToken, fetcher },
      ),
    ).rejects.toMatchObject({ status: 502 });
  });
});

describe("update_invoice_status", () => {
  it("checks current status and posts only InvoiceID and Status", async () => {
    const { fetcher, requests } = createFetcher({
      "https://api.xero.com/connections": connectionsFixture,
      "https://api.xero.com/api.xro/2.0/Invoices/33333333-3333-4333-8333-333333333333": (request: RecordedRequest) => ({
        Invoices: [{ ...invoiceFixture, Status: request.method === "GET" ? "DRAFT" : "AUTHORISED" }],
      }),
    });
    const result = await xeroActionHandlers.update_invoice_status(
      {
        tenant_id: "11111111-1111-4111-8111-111111111111",
        invoice_id: "33333333-3333-4333-8333-333333333333",
        status: "AUTHORISED",
      },
      { accessToken, fetcher },
    );
    const postRequest = requests.find((request) => request.method === "POST");
    expect(postRequest?.body).toEqual({
      Invoices: [{ InvoiceID: "33333333-3333-4333-8333-333333333333", Status: "AUTHORISED" }],
    });
    expect(
      requests.filter((request) => request.url.includes("/Invoices/33333333-3333-4333-8333-333333333333")),
    ).toHaveLength(2);
    expect(result).toMatchObject({
      invoice: { invoice_id: "33333333-3333-4333-8333-333333333333", status: "AUTHORISED" },
    });
  });
});

describe("get_invoice", () => {
  it("parses ASP.NET dates with or without a timezone offset", async () => {
    const { fetcher } = createFetcher({
      "https://api.xero.com/connections": connectionsFixture,
      "https://api.xero.com/api.xro/2.0/Invoices/33333333-3333-4333-8333-333333333333": {
        Invoices: [
          {
            ...invoiceFixture,
            Date: "/Date(1754006400000)/",
            DueDate: "/Date(1756598400000+0000)/",
            DateString: undefined,
            DueDateString: undefined,
          },
        ],
      },
    });
    await expect(
      xeroActionHandlers.get_invoice(
        { tenant_id: "11111111-1111-4111-8111-111111111111", invoice_id: "33333333-3333-4333-8333-333333333333" },
        { accessToken, fetcher },
      ),
    ).resolves.toMatchObject({
      date: "2025-08-01",
      due_date: "2025-08-31",
    });
  });
});

describe("get_balance_sheet", () => {
  it("sends the as-at date query parameter Xero expects", async () => {
    const { fetcher, requests } = createFetcher({
      "https://api.xero.com/connections": connectionsFixture,
      "https://api.xero.com/api.xro/2.0/Reports/BalanceSheet": {
        Reports: [{ ReportID: "bs-1", ReportName: "BalanceSheet", ReportTitles: ["Balance Sheet"], Rows: [] }],
      },
    });
    await xeroActionHandlers.get_balance_sheet(
      { tenant_id: "11111111-1111-4111-8111-111111111111", date: "2026-08-01" },
      { accessToken, fetcher },
    );
    const reportRequest = requests.find((request) => request.url.includes("/Reports/BalanceSheet"));
    expect(reportRequest?.url).toContain("date=2026-08-01");
    expect(reportRequest?.url).not.toContain("fromDate");
    expect(reportRequest?.url).not.toContain("toDate");
  });
});

describe("get_profit_and_loss", () => {
  it("parses report sections into labelled rows an agent can summarise", async () => {
    const reportFixture = {
      ReportID: "report-1",
      ReportName: "ProfitAndLoss",
      ReportTitles: ["Profit and Loss", "Demo Company", "01 August 2026 to 31 August 2026"],
      ReportDate: "2026-08-13T00:00:00",
      Rows: [
        {
          RowType: "Section",
          Title: "Revenue",
          Rows: [
            { RowType: "Row", Cells: [{ Value: "Sales" }, { Value: "10000.00" }] },
            { RowType: "SummaryRow", Cells: [{ Value: "Total Revenue" }, { Value: "10000.00" }] },
          ],
        },
        {
          RowType: "Section",
          Title: "Expenses",
          Rows: [
            { RowType: "Row", Cells: [{ Value: "Rent" }, { Value: "2000.00" }] },
            { RowType: "SummaryRow", Cells: [{ Value: "Total Expenses" }, { Value: "2000.00" }] },
          ],
        },
      ],
    };
    const { fetcher } = createFetcher({
      "https://api.xero.com/connections": connectionsFixture,
      "https://api.xero.com/api.xro/2.0/Reports/ProfitAndLoss": { Reports: [reportFixture] },
    });
    await expect(
      xeroActionHandlers.get_profit_and_loss(
        { tenant_id: "11111111-1111-4111-8111-111111111111" },
        { accessToken, fetcher },
      ),
    ).resolves.toMatchObject({
      report_id: "report-1",
      report_name: "ProfitAndLoss",
      titles: ["Profit and Loss", "Demo Company", "01 August 2026 to 31 August 2026"],
      generated_at: "2026-08-13T00:00:00",
      sections: [
        {
          title: "Revenue",
          rows: [
            { label: "Sales", value: "10000.00", is_total: false },
            { label: "Total Revenue", value: "10000.00", is_total: true },
          ],
        },
        {
          title: "Expenses",
          rows: [
            { label: "Rent", value: "2000.00", is_total: false },
            { label: "Total Expenses", value: "2000.00", is_total: true },
          ],
        },
      ],
    });
  });
});
