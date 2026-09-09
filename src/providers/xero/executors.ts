import type { CredentialValidators, ProviderExecutors } from "../../core/types.ts";
import type { ProviderActionHandlers } from "../provider-runtime.ts";
import type { OAuthProviderContext, ProviderRuntimeHandler } from "../provider-runtime.ts";

import {
  optionalScalarString,
  recordOrEmpty,
  optionalStringArray,
  optionalBoolean,
  optionalInteger,
  optionalNumber,
  optionalString,
  requiredString,
} from "../../core/cast.ts";
import { arrayPayload, firstString, objectPayload, requestJson } from "../http-json-runtime.ts";
import {
  defineOAuthProviderExecutors,
  combineProviderActionHandlers,
  ProviderRequestError,
} from "../provider-runtime.ts";
import { mapXeroContact, mapXeroInvoice } from "./runtime-accounting-input.ts";
import { xeroAccountingReadHandlers } from "./runtime-accounting-reads.ts";
import { validateXeroLines, readXeroAccountingRecord, assertXeroStatus } from "./runtime-accounting-validation.ts";
import { xeroAccountingWriteHandlers } from "./runtime-accounting-writes.ts";
import { xeroAssetHandlers } from "./runtime-assets.ts";
import { xeroFileHandlers } from "./runtime-files.ts";
import { escapeXeroWhereValue } from "./runtime-input.ts";
import { xeroPayrollHandlers } from "./runtime-payroll.ts";
import { xeroProjectHandlers } from "./runtime-projects.ts";
import { xeroRequest, resolveTenantId, requireXeroGuid } from "./runtime-request.ts";

const service = "xero";
const identityBaseUrl = "https://api.xero.com";
const xeroUserinfoBaseUrl = "https://identity.xero.com";
const xeroUserinfoPath = "/connect/userinfo";
const xeroUserinfoUrl = `${xeroUserinfoBaseUrl}${xeroUserinfoPath}`;
const apiPackage = "OpenConnector";

type XeroHandler = ProviderRuntimeHandler<OAuthProviderContext>;

export const xeroActionHandlers: ProviderActionHandlers<"xero", XeroHandler> = combineProviderActionHandlers(
  "xero",
  xeroAccountingReadHandlers,
  xeroAccountingWriteHandlers,
  xeroProjectHandlers,
  xeroAssetHandlers,
  xeroPayrollHandlers,
  xeroFileHandlers,
  {
    async list_organisations(_input, context): Promise<unknown> {
      const connections = arrayPayload(
        await requestJson({
          providerName: service,
          baseUrl: identityBaseUrl,
          path: "/connections",
          fetcher: context.fetcher,
          headers: bearerHeaders(context.accessToken),
        }),
        "Xero connections",
      );
      return {
        organisations: connections.map((connection) => {
          const record = recordOrEmpty(connection);
          return {
            tenant_id: record.tenantId,
            tenant_name: record.tenantName,
            tenant_type: record.tenantType,
          };
        }),
      };
    },
    async get_organisation(input, context): Promise<unknown> {
      const tenantId = await resolveTenantId(input, context);
      const payload = await xeroRequest(context, { path: "/Organisation", tenantId });
      const organisations = resourceList(payload, "Organisations");
      return mapOrganisation(requireFirst(organisations, "Organisation was not found."));
    },
    async search_contacts(input, context): Promise<unknown> {
      const tenantId = await resolveTenantId(input, context);
      const page = optionalInteger(input.page) ?? 1;
      const search = optionalString(input.search);
      const payload = await xeroRequest(context, {
        path: "/Contacts",
        tenantId,
        query: compactQuery({
          searchTerm: search,
          where: optionalString(input.account_number)
            ? `AccountNumber=="${escapeXeroWhereValue(requiredString(input.account_number, "account_number"))}"`
            : undefined,
          page: String(page),
        }),
      });
      return pageResult(resourceList(payload, "Contacts"), page, mapContact);
    },
    async get_contact(input, context): Promise<unknown> {
      const tenantId = await resolveTenantId(input, context);
      const contactId = requireXeroGuid(input.contact_id, "contact_id");
      const payload = await xeroRequest(context, { path: `/Contacts/${contactId}`, tenantId });
      const contacts = resourceList(payload, "Contacts");
      return contacts.length > 0 ? mapContact(contacts[0]) : null;
    },
    async create_contact(input, context): Promise<unknown> {
      const tenantId = await resolveTenantId(input, context);
      const payload = await xeroRequest(context, {
        path: "/Contacts",
        method: "PUT",
        tenantId,
        idempotencyKey: optionalString(input.idempotency_key),
        body: { Contacts: [mapXeroContact(input)] },
      });
      const contacts = resourceList(payload, "Contacts");
      return { contact: mapContact(requireFirst(contacts, "Xero did not return the created contact.", 502)) };
    },
    async search_invoices(input, context): Promise<unknown> {
      const tenantId = await resolveTenantId(input, context);
      const page = optionalInteger(input.page) ?? 1;
      const status = optionalString(input.status);
      const payload = await xeroRequest(context, {
        path: "/Invoices",
        tenantId,
        query: compactQuery({
          Statuses: status ?? "DRAFT,SUBMITTED,AUTHORISED,PAID",
          ContactIDs: optionalStringArray(input.contact_ids)?.join(","),
          InvoiceNumbers: optionalStringArray(input.invoice_numbers)?.join(","),
          where: xeroDocumentWhere(input),
          page: String(page),
        }),
      });
      return pageResult(resourceList(payload, "Invoices"), page, mapInvoiceSummary);
    },
    async get_invoice(input, context): Promise<unknown> {
      const tenantId = await resolveTenantId(input, context);
      const invoiceId = requireXeroGuid(input.invoice_id, "invoice_id");
      const payload = await xeroRequest(context, { path: `/Invoices/${invoiceId}`, tenantId });
      const invoices = resourceList(payload, "Invoices");
      return invoices.length > 0 ? mapInvoiceDetail(invoices[0]) : null;
    },
    async create_invoice(input, context): Promise<unknown> {
      const tenantId = await resolveTenantId(input, context);
      validateXeroLines(input, true);
      const invoice = mapXeroInvoice(input);
      invoice.Type = optionalString(input.type) ?? "ACCREC";
      invoice.Status = "DRAFT";
      invoice.DueDate = optionalString(input.due_date) ?? defaultDueDate(optionalString(input.date));
      const payload = await xeroRequest(context, {
        path: "/Invoices",
        method: "PUT",
        tenantId,
        idempotencyKey: optionalString(input.idempotency_key),
        body: { Invoices: [invoice] },
      });
      const invoices = resourceList(payload, "Invoices");
      return { invoice: mapInvoiceDetail(requireFirst(invoices, "Xero did not return the created invoice.", 502)) };
    },
    async update_invoice_status(input, context): Promise<unknown> {
      const tenantId = await resolveTenantId(input, context);
      const invoiceId = requireXeroGuid(input.invoice_id, "invoice_id");
      const status = requiredString(input.status, "status");
      const allowed: Record<string, string[]> = {
        DRAFT: ["SUBMITTED"],
        SUBMITTED: ["DRAFT"],
        AUTHORISED: ["DRAFT", "SUBMITTED"],
        VOIDED: ["AUTHORISED"],
        DELETED: ["DRAFT", "SUBMITTED"],
      };
      if (!allowed[status]) throw new ProviderRequestError(400, "Unsupported invoice status transition.");
      assertXeroStatus(
        await readXeroAccountingRecord(context, tenantId, "Invoices", invoiceId),
        allowed[status],
        "update_invoice_status",
      );
      const updated = await xeroRequest(context, {
        path: `/Invoices/${invoiceId}`,
        method: "POST",
        tenantId,
        idempotencyKey: optionalString(input.idempotency_key),
        body: { Invoices: [{ InvoiceID: invoiceId, Status: status }] },
      });
      const invoices = resourceList(updated, "Invoices");
      return { invoice: mapInvoiceSummary(requireFirst(invoices, `Invoice not found: ${invoiceId}`)) };
    },
    async list_accounts(input, context): Promise<unknown> {
      const tenantId = await resolveTenantId(input, context);
      const status = optionalString(input.status);
      const payload = await xeroRequest(context, {
        path: "/Accounts",
        tenantId,
        query: compactQuery({ where: status ? `Status=="${status}"` : undefined }),
      });
      return { accounts: resourceList(payload, "Accounts").map(mapAccount) };
    },
    async get_account(input, context): Promise<unknown> {
      const tenantId = await resolveTenantId(input, context);
      const accountId = requireXeroGuid(input.account_id, "account_id");
      const payload = await xeroRequest(context, { path: `/Accounts/${accountId}`, tenantId });
      const accounts = resourceList(payload, "Accounts");
      return accounts.length > 0 ? mapAccount(accounts[0]) : null;
    },
    async search_bank_transactions(input, context): Promise<unknown> {
      const tenantId = await resolveTenantId(input, context);
      const page = optionalInteger(input.page) ?? 1;
      const status = optionalString(input.status);
      const payload = await xeroRequest(context, {
        path: "/BankTransactions",
        tenantId,
        query: compactQuery({
          where: xeroDocumentWhere(input, status),
          page: String(page),
        }),
      });
      return pageResult(resourceList(payload, "BankTransactions"), page, mapBankTransactionSummary);
    },
    async get_bank_transaction(input, context): Promise<unknown> {
      const tenantId = await resolveTenantId(input, context);
      const bankTransactionId = requireXeroGuid(input.bank_transaction_id, "bank_transaction_id");
      const payload = await xeroRequest(context, {
        path: `/BankTransactions/${bankTransactionId}`,
        tenantId,
      });
      const transactions = resourceList(payload, "BankTransactions");
      return transactions.length > 0 ? mapBankTransactionDetail(transactions[0]) : null;
    },
    async get_profit_and_loss(input, context): Promise<unknown> {
      return fetchReport(input, context, "ProfitAndLoss", {
        periods: optionalScalarString(input.periods),
        timeframe: optionalScalarString(input.timeframe),
        trackingCategoryID: optionalScalarString(input.tracking_category_id),
        trackingCategoryID2: optionalScalarString(input.tracking_category_id_2),
        trackingOptionID: optionalScalarString(input.tracking_option_id),
        trackingOptionID2: optionalScalarString(input.tracking_option_id_2),
        standardLayout: optionalScalarString(input.standard_layout),
        paymentsOnly: optionalScalarString(input.payments_only),
        fromDate: optionalString(input.from_date),
        toDate: optionalString(input.to_date),
      });
    },
    async get_balance_sheet(input, context): Promise<unknown> {
      return fetchReport(input, context, "BalanceSheet", {
        periods: optionalScalarString(input.periods),
        timeframe: optionalScalarString(input.timeframe),
        trackingOptionID1: optionalScalarString(input.tracking_option_id_1),
        trackingOptionID2: optionalScalarString(input.tracking_option_id_2),
        standardLayout: optionalScalarString(input.standard_layout),
        paymentsOnly: optionalScalarString(input.payments_only),
        date: optionalString(input.date),
      });
    },
    async list_payments(input, context): Promise<unknown> {
      const tenantId = await resolveTenantId(input, context);
      const page = optionalInteger(input.page) ?? 1;
      const invoiceNumber = optionalString(input.invoice_number);
      const invoiceId = optionalString(input.invoice_id);
      const paymentId = optionalString(input.payment_id);
      const reference = optionalString(input.reference);
      const conditions = [
        invoiceNumber ? `Invoice.InvoiceNumber=="${escapeXeroWhereValue(invoiceNumber)}"` : undefined,
        invoiceId ? `Invoice.InvoiceID==guid("${requireXeroGuid(invoiceId, "invoice_id")}")` : undefined,
        paymentId ? `PaymentID==guid("${requireXeroGuid(paymentId, "payment_id")}")` : undefined,
        reference ? `Reference=="${escapeXeroWhereValue(reference)}"` : undefined,
        input.include_deleted === true ? undefined : 'Status!="DELETED"',
      ].filter((condition): condition is string => condition !== undefined);
      const where = conditions.length > 0 ? conditions.join(" AND ") : undefined;
      const payload = await xeroRequest(context, {
        path: "/Payments",
        tenantId,
        query: compactQuery({
          where,
          page: String(page),
          pageSize: optionalIntegerString(input.page_size) ?? "10",
        }),
      });
      return pageResult(resourceList(payload, "Payments"), page, identity);
    },
    async get_payment(input, context): Promise<unknown> {
      const tenantId = await resolveTenantId(input, context);
      return firstResourceOrNull(
        await xeroRequest(context, {
          path: `/Payments/${encodeURIComponent(requiredString(input.payment_id, "payment_id"))}`,
          tenantId,
        }),
        "Payments",
      );
    },
    async list_quotes(input, context): Promise<unknown> {
      const tenantId = await resolveTenantId(input, context);
      const page = optionalInteger(input.page) ?? 1;
      const payload = await xeroRequest(context, {
        path: "/Quotes",
        tenantId,
        query: compactQuery({
          Status: optionalString(input.status),
          ContactID: optionalString(input.contact_id),
          QuoteNumber: optionalString(input.quote_number),
          page: String(page),
        }),
      });
      return pageResult(resourceList(payload, "Quotes"), page, identity);
    },
    async get_quote(input, context): Promise<unknown> {
      const tenantId = await resolveTenantId(input, context);
      return firstResourceOrNull(
        await xeroRequest(context, {
          path: `/Quotes/${encodeURIComponent(requiredString(input.quote_id, "quote_id"))}`,
          tenantId,
        }),
        "Quotes",
      );
    },
    async list_purchase_orders(input, context): Promise<unknown> {
      const tenantId = await resolveTenantId(input, context);
      const page = optionalInteger(input.page) ?? 1;
      const payload = await xeroRequest(context, {
        path: "/PurchaseOrders",
        tenantId,
        query: compactQuery({
          Status: optionalString(input.status),
          DateFrom: optionalString(input.date_from),
          DateTo: optionalString(input.date_to),
          page: String(page),
          pageSize: optionalIntegerString(input.page_size),
        }),
      });
      return pageResult(resourceList(payload, "PurchaseOrders"), page, identity);
    },
    async get_purchase_order(input, context): Promise<unknown> {
      const tenantId = await resolveTenantId(input, context);
      return firstResourceOrNull(
        await xeroRequest(context, {
          path: `/PurchaseOrders/${encodeURIComponent(requiredString(input.purchase_order_id, "purchase_order_id"))}`,
          tenantId,
        }),
        "PurchaseOrders",
      );
    },
    async list_items(input, context): Promise<unknown> {
      const tenantId = await resolveTenantId(input, context);
      const items = resourceList(await xeroRequest(context, { path: "/Items", tenantId }), "Items");
      return { items, returned: items.length };
    },
    async get_item(input, context): Promise<unknown> {
      const tenantId = await resolveTenantId(input, context);
      return firstResourceOrNull(
        await xeroRequest(context, {
          path: `/Items/${encodeURIComponent(requiredString(input.item_id, "item_id"))}`,
          tenantId,
        }),
        "Items",
      );
    },
    async list_journals(input, context): Promise<unknown> {
      const tenantId = await resolveTenantId(input, context);
      const paymentsOnly = optionalBoolean(input.payments_only);
      const payload = await xeroRequest(context, {
        path: "/Journals",
        tenantId,
        query: compactQuery({
          offset: optionalIntegerString(input.offset),
          paymentsOnly: paymentsOnly === undefined ? undefined : String(paymentsOnly),
        }),
      });
      const journals = resourceList(payload, "Journals");
      const lastJournalNumber = optionalInteger(recordOrEmpty(journals.at(-1)).JournalNumber);
      return {
        items: journals,
        returned: journals.length,
        next_offset: journals.length === 100 ? (lastJournalNumber ?? null) : null,
      };
    },
    async get_journal(input, context): Promise<unknown> {
      const tenantId = await resolveTenantId(input, context);
      return firstResourceOrNull(
        await xeroRequest(context, {
          path: `/Journals/${requireXeroGuid(input.journal_id, "journal_id")}`,
          tenantId,
        }),
        "Journals",
      );
    },
    async list_tax_rates(input, context): Promise<unknown> {
      const tenantId = await resolveTenantId(input, context);
      const payload = await xeroRequest(context, { path: "/TaxRates", tenantId });
      return { tax_rates: resourceList(payload, "TaxRates") };
    },
    async list_tracking_categories(input, context): Promise<unknown> {
      const tenantId = await resolveTenantId(input, context);
      const includeArchived = optionalBoolean(input.include_archived);
      const payload = await xeroRequest(context, {
        path: "/TrackingCategories",
        tenantId,
        query: compactQuery({ includeArchived: includeArchived === undefined ? undefined : String(includeArchived) }),
      });
      return { tracking_categories: resourceList(payload, "TrackingCategories") };
    },
  },
);

export const executors: ProviderExecutors = defineOAuthProviderExecutors(service, xeroActionHandlers);

export const credentialValidators: CredentialValidators = {
  async oauth2(input, { fetcher, signal }) {
    const payload = objectPayload(
      await requestJson({
        providerName: service,
        baseUrl: xeroUserinfoBaseUrl,
        path: xeroUserinfoPath,
        fetcher,
        signal,
        headers: bearerHeaders(input.accessToken),
        phase: "validate",
      }),
      "Xero userinfo",
    );
    const accountId = optionalString(payload.sub) ?? optionalString(payload.xero_userid);
    if (!accountId) {
      throw new ProviderRequestError(502, "Xero userinfo response is missing sub");
    }
    return {
      profile: {
        accountId,
        displayName: firstString(payload, ["name", "preferred_username", "email"]) ?? accountId,
      },
      metadata: {
        validationEndpoint: xeroUserinfoUrl,
      },
    };
  },
};

/** Xero requires a due date on approved invoices; default to a 30-day term. */
function defaultDueDate(date: string | undefined): string | undefined {
  if (!date) {
    return undefined;
  }
  const parsed = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) {
    return undefined;
  }
  parsed.setUTCDate(parsed.getUTCDate() + 30);
  return parsed.toISOString().slice(0, 10);
}

function bearerHeaders(accessToken: string, tenantId?: string): Record<string, string> {
  return {
    authorization: `Bearer ${accessToken}`,
    "xero-api-package": apiPackage,
    ...(tenantId ? { "xero-tenant-id": tenantId } : {}),
  };
}

function resourceList(payload: unknown, key: string): unknown[] {
  const items = recordOrEmpty(payload)[key];
  return Array.isArray(items) ? items : [];
}

function requireFirst(items: unknown[], message: string, status = 404): unknown {
  if (items.length === 0) {
    throw new ProviderRequestError(status, message);
  }
  return items[0];
}

function pageResult<T>(items: unknown[], page: number, map: (raw: unknown) => T): Record<string, unknown> {
  return { items: items.map(map), page, returned: items.length };
}

function firstResourceOrNull(payload: unknown, key: string): unknown {
  return resourceList(payload, key)[0] ?? null;
}

function identity(value: unknown): unknown {
  return value;
}

function optionalIntegerString(value: unknown): string | undefined {
  const integer = optionalInteger(value);
  return integer === undefined ? undefined : String(integer);
}

function compactQuery(query: Record<string, string | undefined>): Record<string, string> {
  return Object.fromEntries(Object.entries(query).filter(([, value]) => value !== undefined)) as Record<string, string>;
}

function mapLineItem(raw: unknown): Record<string, unknown> {
  const record = recordOrEmpty(raw);
  return {
    line_item_id: record.LineItemID ?? null,
    description: record.Description ?? null,
    quantity: optionalNumber(record.Quantity) ?? 0,
    unit_amount: optionalNumber(record.UnitAmount) ?? 0,
    line_amount: optionalNumber(record.LineAmount) ?? 0,
    account_code: record.AccountCode ?? null,
    tax_type: record.TaxType ?? null,
    tax_amount: record.TaxAmount ?? null,
    item_code: record.ItemCode ?? null,
    tracking: record.Tracking ?? [],
    discount_rate: record.DiscountRate ?? null,
  };
}

function mapContact(raw: unknown): Record<string, unknown> {
  const record = recordOrEmpty(raw);
  const phones = Array.isArray(record.Phones) ? record.Phones : [];
  return {
    contact_id: record.ContactID ?? null,
    name: record.Name ?? "",
    first_name: record.FirstName ?? null,
    last_name: record.LastName ?? null,
    email_address: record.EmailAddress ?? null,
    phone: phones.length > 0 ? (recordOrEmpty(phones[0]).PhoneNumber ?? null) : null,
    is_customer: record.IsCustomer ?? false,
    is_supplier: record.IsSupplier ?? false,
    account_number: record.AccountNumber ?? null,
    status: record.ContactStatus ?? record.Status ?? "",
    addresses: record.Addresses ?? [],
    phones: record.Phones ?? [],
    tax_number: record.TaxNumber ?? null,
    balances: record.Balances ?? null,
    contact_persons: record.ContactPersons ?? [],
    payment_terms: record.PaymentTerms ?? null,
  };
}

function mapInvoiceSummary(raw: unknown): Record<string, unknown> {
  const record = recordOrEmpty(raw);
  const lineItems = Array.isArray(record.LineItems) ? record.LineItems : [];
  return {
    invoice_id: record.InvoiceID ?? null,
    invoice_number: record.InvoiceNumber ?? "",
    type: record.Type ?? "",
    status: record.Status ?? "",
    date: xeroDate(record.DateString ?? record.Date),
    due_date: xeroDate(record.DueDateString ?? record.DueDate),
    total: optionalNumber(record.Total) ?? 0,
    amount_due: optionalNumber(record.AmountDue) ?? 0,
    currency_code: record.CurrencyCode ?? "",
    contact_name: recordOrEmpty(record.Contact).Name ?? null,
    line_item_count: lineItems.length,
  };
}

function mapInvoiceDetail(raw: unknown): Record<string, unknown> {
  const record = recordOrEmpty(raw);
  const lineItems = Array.isArray(record.LineItems) ? record.LineItems : [];
  return {
    ...mapInvoiceSummary(raw),
    reference: record.Reference ?? null,
    payments: record.Payments ?? [],
    credit_notes: record.CreditNotes ?? [],
    prepayments: record.Prepayments ?? [],
    overpayments: record.Overpayments ?? [],
    line_items: lineItems.map(mapLineItem),
    line_amount_types: record.LineAmountTypes ?? null,
    currency_rate: record.CurrencyRate ?? null,
    warnings: record.Warnings ?? [],
    validation_errors: record.ValidationErrors ?? [],
  };
}

function mapBankTransactionSummary(raw: unknown): Record<string, unknown> {
  const record = recordOrEmpty(raw);
  const lineItems = Array.isArray(record.LineItems) ? record.LineItems : [];
  const transactionId =
    optionalString(record.BankTransactionID) ??
    optionalString(record.OverpaymentID) ??
    optionalString(record.PrepaymentID);
  if (!transactionId) {
    throw new ProviderRequestError(502, "Xero did not return a bank transaction identifier.");
  }
  return {
    transaction_id: transactionId,
    type: record.Type ?? "",
    status: record.Status ?? "",
    date: xeroDate(record.DateString ?? record.Date),
    total: optionalNumber(record.Total) ?? 0,
    currency_code: record.CurrencyCode ?? "",
    contact_name: recordOrEmpty(record.Contact).Name ?? null,
    line_item_count: lineItems.length,
  };
}

function mapBankTransactionDetail(raw: unknown): Record<string, unknown> {
  const record = recordOrEmpty(raw);
  const lineItems = Array.isArray(record.LineItems) ? record.LineItems : [];
  return {
    ...mapBankTransactionSummary(raw),
    reference: record.Reference ?? null,
    is_reconciled: record.IsReconciled ?? null,
    bank_account: record.BankAccount ?? null,
    line_items: lineItems.map(mapLineItem),
    line_amount_types: record.LineAmountTypes ?? null,
    currency_rate: record.CurrencyRate ?? null,
    warnings: record.Warnings ?? [],
    validation_errors: record.ValidationErrors ?? [],
  };
}

function mapAccount(raw: unknown): Record<string, unknown> {
  const record = recordOrEmpty(raw);
  return {
    account_id: record.AccountID ?? null,
    code: record.Code ?? "",
    name: record.Name ?? "",
    type: record.Type ?? "",
    status: record.Status ?? "",
    tax_type: record.TaxType ?? null,
    description: record.Description ?? null,
    bank_account_number: record.BankAccountNumber ?? null,
    bank_account_type: record.BankAccountType ?? null,
    enable_payments_to_account: record.EnablePaymentsToAccount ?? null,
    system_account: record.SystemAccount ?? null,
    reporting_code: record.ReportingCode ?? null,
    currency_code: record.CurrencyCode ?? "",
  };
}

function mapOrganisation(raw: unknown): Record<string, unknown> {
  const record = recordOrEmpty(raw);
  return {
    organisation_id: record.OrganisationID ?? null,
    name: record.Name ?? "",
    legal_name: record.LegalName ?? "",
    currency_code: record.BaseCurrency ?? "",
    country_code: record.CountryCode ?? "",
    timezone: record.Timezone ?? "",
    tax_system_type: record.TaxSystemType ?? "",
    version: record.Version ?? null,
    short_code: record.ShortCode ?? null,
    organisation_status: record.OrganisationStatus ?? null,
  };
}

function mapReport(raw: unknown): Record<string, unknown> {
  const record = recordOrEmpty(raw);
  const rows = Array.isArray(record.Rows) ? record.Rows : [];
  return {
    report_id: record.ReportID ?? "",
    report_name: record.ReportName ?? "",
    titles: Array.isArray(record.ReportTitles) ? record.ReportTitles.filter((title) => typeof title === "string") : [],
    generated_at: record.ReportDate ?? null,
    sections: parseReportSections(rows),
    rows,
  };
}

function parseReportSections(rows: unknown[]): Record<string, unknown>[] {
  const sections = rows.filter((row) => recordOrEmpty(row).RowType === "Section");
  const mapped = sections.map((section) => {
    const record = recordOrEmpty(section);
    const sectionRows = Array.isArray(record.Rows) ? record.Rows : [];
    return {
      title: optionalString(record.Title) ?? null,
      rows: sectionRows
        .map((row) => {
          const rowRecord = recordOrEmpty(row);
          const cells = Array.isArray(rowRecord.Cells) ? rowRecord.Cells : [];
          return {
            label: cells.length > 0 ? (optionalString(recordOrEmpty(cells[0]).Value) ?? "") : "",
            value: cells.length > 1 ? (optionalString(recordOrEmpty(cells[1]).Value) ?? null) : null,
            is_total: rowRecord.RowType === "SummaryRow",
            values: cells.map((cell) => recordOrEmpty(cell).Value ?? null),
          };
        })
        .filter((row) => row.label !== ""),
    };
  });
  if (mapped.length > 0) {
    return mapped;
  }
  return [
    {
      title: null,
      rows: rows.map((row) => {
        const rowRecord = recordOrEmpty(row);
        const cells = Array.isArray(rowRecord.Cells) ? rowRecord.Cells : [];
        return {
          label: cells.length > 0 ? (optionalString(recordOrEmpty(cells[0]).Value) ?? "") : "",
          value: cells.length > 1 ? (optionalString(recordOrEmpty(cells[1]).Value) ?? null) : null,
          is_total: rowRecord.RowType === "SummaryRow",
          values: cells.map((cell) => recordOrEmpty(cell).Value ?? null),
        };
      }),
    },
  ];
}

async function fetchReport(
  input: Record<string, unknown>,
  context: OAuthProviderContext,
  report: string,
  query: Record<string, string | undefined>,
): Promise<unknown> {
  const tenantId = await resolveTenantId(input, context);
  const payload = await xeroRequest(context, {
    path: `/Reports/${report}`,
    tenantId,
    query: compactQuery(query),
  });
  const reports = resourceList(payload, "Reports");
  return mapReport(requireFirst(reports, `${report} report was not found.`));
}

function xeroDate(value: unknown): string | null {
  if (typeof value !== "string" || !value) {
    return null;
  }
  const epoch = /^\/Date\((\d+)(?:[+-]\d{4})?\)\/$/.exec(value);
  if (epoch) {
    return new Date(Number(epoch[1])).toISOString().slice(0, 10);
  }
  return /^\d{4}-\d{2}-\d{2}/.test(value) ? value.slice(0, 10) : null;
}

function xeroDocumentWhere(input: Record<string, unknown>, status?: string): string | undefined {
  const clauses: string[] = [];
  for (const [field, key] of [
    ["Type", "type"],
    ["Status", "status"],
  ]) {
    const value = key === "status" ? status : optionalString(input[key]);
    if (value) clauses.push(`${field}=="${escapeXeroWhereValue(value)}"`);
  }
  for (const [field, key] of [
    ["BankAccount.AccountID", "bank_account_id"],
    ["Contact.ContactID", "contact_id"],
  ])
    if (input[key] !== undefined) clauses.push(`${field}==Guid("${requireXeroGuid(input[key], key)}")`);
  for (const [key, operator] of [
    ["from_date", ">="],
    ["to_date", "<="],
  ]) {
    const value = optionalString(input[key]);
    if (value) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new ProviderRequestError(400, `${key} must be a calendar date.`);
      clauses.push(`Date${operator}DateTime(${value.split("-").map(Number).join(",")})`);
    }
  }
  return clauses.length ? clauses.join(" AND ") : undefined;
}
