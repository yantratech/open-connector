import type { ActionDefinition, JsonSchema } from "../../core/types.ts";

import { s } from "../../core/json-schema.ts";
import { defineProviderAction } from "../../core/provider-definition.ts";
import {
  xeroBalanceSheetReadScope,
  xeroBankTransactionsReadScope,
  xeroContactsReadScope,
  xeroContactsWriteScope,
  xeroInvoicesReadScope,
  xeroInvoicesWriteScope,
  xeroJournalsReadScope,
  xeroPaymentsReadScope,
  xeroProfitAndLossReadScope,
  xeroSettingsReadScope,
} from "./scopes.ts";

const service = "xero";

const money = s.number("A monetary amount.");
const tenantId = s.uuid("The Xero tenant (organisation) ID for this connection.");
const tenantField = { tenant_id: tenantId };
const pageInput = s.integer({
  minimum: 1,
  default: 1,
  description: "The page number to return. Xero returns up to 100 items per page.",
});
const pageOutput = s.integer({
  minimum: 1,
  description: "The page number that was returned.",
});
const xeroId = s.uuid("A Xero resource ID.");
const transactionId = s.uuid("The Xero identifier for a bank transaction, overpayment, or prepayment.");
const accountStatuses = ["ACTIVE", "ARCHIVED", "DELETED"];
const bankTransactionStatuses = ["AUTHORISED", "DELETED", "PAID", "VOIDED"];
const bankTransactionTypes = [
  "RECEIVE",
  "RECEIVE-OVERPAYMENT",
  "RECEIVE-PREPAYMENT",
  "SPEND",
  "SPEND-OVERPAYMENT",
  "SPEND-PREPAYMENT",
  "RECEIVE-TRANSFER",
  "SPEND-TRANSFER",
];
const invoiceStatuses = ["DRAFT", "SUBMITTED", "AUTHORISED", "PAID", "VOIDED", "DELETED"];

const lineItemInput = s.object(
  {
    description: s.string({ description: "The line item description." }),
    quantity: s.number({ description: "The quantity." }),
    unit_amount: s.number({ description: "The unit price excluding tax." }),
    account_code: s.string({ description: "The account code this line is posted to." }),
  },
  {
    required: ["description", "quantity", "unit_amount", "account_code"],
    description: "An invoice or bank transaction line item.",
  },
);

const lineItemOutput = s.object(
  {
    line_item_id: xeroId,
    description: s.nullableString("The line item description."),
    quantity: money,
    unit_amount: money,
    line_amount: money,
    account_code: s.nullableString("The account code this line is posted to."),
  },
  {
    required: ["line_item_id", "quantity", "unit_amount", "line_amount"],
    additionalProperties: true,
    description: "A line item with computed amounts.",
  },
);

const contactSummary = s.object(
  {
    contact_id: xeroId,
    name: s.string(),
    first_name: s.nullableString("The contact's first name."),
    last_name: s.nullableString("The contact's last name."),
    email_address: s.nullableString("The contact's email address."),
    phone: s.nullableString("The contact's phone number."),
    is_customer: s.boolean(),
    is_supplier: s.boolean(),
    account_number: s.nullableString("The account number in the accounting system."),
    status: s.string(),
  },
  {
    required: ["contact_id", "name", "is_customer", "is_supplier", "status"],
    additionalProperties: true,
    description: "A contact summary.",
  },
);

const invoiceSummary = s.object(
  {
    invoice_id: xeroId,
    invoice_number: s.string(),
    type: s.stringEnum(["ACCREC", "ACCPAY"]),
    status: s.stringEnum(invoiceStatuses),
    date: s.nullableString("The invoice date (YYYY-MM-DD)."),
    due_date: s.nullableString("The due date (YYYY-MM-DD)."),
    total: money,
    amount_due: money,
    currency_code: s.string(),
    contact_name: s.nullableString("The linked contact name."),
    line_item_count: s.integer(),
  },
  {
    required: [
      "invoice_id",
      "invoice_number",
      "type",
      "status",
      "date",
      "total",
      "amount_due",
      "currency_code",
      "line_item_count",
    ],
    additionalProperties: true,
    description: "An invoice summary.",
  },
);

const invoiceDetail = s.object(
  {
    invoice_id: xeroId,
    invoice_number: s.string(),
    type: s.stringEnum(["ACCREC", "ACCPAY"]),
    status: s.stringEnum(invoiceStatuses),
    date: s.nullableString("The invoice date (YYYY-MM-DD)."),
    due_date: s.nullableString("The due date (YYYY-MM-DD)."),
    reference: s.nullableString("The invoice reference."),
    total: money,
    amount_due: money,
    currency_code: s.string(),
    contact_name: s.nullableString("The linked contact name."),
    line_items: s.array(lineItemOutput, { description: "The invoice line items." }),
  },
  {
    required: [
      "invoice_id",
      "invoice_number",
      "type",
      "status",
      "date",
      "total",
      "amount_due",
      "currency_code",
      "line_items",
    ],
    additionalProperties: true,
    description: "An invoice with line items.",
  },
);

const bankTransactionSummary = s.object(
  {
    transaction_id: transactionId,
    type: s.stringEnum(bankTransactionTypes),
    status: s.stringEnum(bankTransactionStatuses),
    date: s.nullableString("The transaction date (YYYY-MM-DD)."),
    total: money,
    currency_code: s.string(),
    contact_name: s.nullableString("The linked contact name."),
    line_item_count: s.integer(),
  },
  {
    required: ["transaction_id", "type", "status", "date", "total", "currency_code", "line_item_count"],
    additionalProperties: true,
    description: "A bank transaction summary.",
  },
);

const bankTransactionDetail = s.object(
  {
    transaction_id: transactionId,
    type: s.stringEnum(bankTransactionTypes),
    status: s.stringEnum(bankTransactionStatuses),
    date: s.nullableString("The transaction date (YYYY-MM-DD)."),
    reference: s.nullableString("The transaction reference."),
    total: money,
    currency_code: s.string(),
    contact_name: s.nullableString("The linked contact name."),
    line_items: s.array(lineItemOutput, { description: "The transaction line items." }),
  },
  {
    required: ["transaction_id", "type", "status", "date", "total", "currency_code", "line_items"],
    additionalProperties: true,
    description: "A bank transaction with line items.",
  },
);

const accountSummary = s.object(
  {
    account_id: xeroId,
    code: s.string(),
    name: s.string(),
    type: s.string(),
    status: s.stringEnum(accountStatuses),
    tax_type: s.nullableString("The default tax type."),
    currency_code: s.string(),
  },
  {
    required: ["account_id", "code", "name", "type", "status", "currency_code"],
    additionalProperties: true,
    description: "An account summary.",
  },
);

const tenantSummary = s.object(
  {
    tenant_id: tenantId,
    tenant_name: s.string(),
    tenant_type: s.string(),
  },
  {
    required: ["tenant_id", "tenant_name", "tenant_type"],
    description: "An organisation connected to this Xero account.",
  },
);

const reportRow = s.object(
  {
    label: s.string(),
    value: s.nullableString("The formatted cell value."),
    is_total: s.boolean(),
  },
  {
    required: ["label", "is_total"],
    description: "A row inside a report section.",
  },
);

const reportSection = s.object(
  {
    title: s.nullableString("The section title, for example Operating Income."),
    rows: s.array(reportRow, { description: "The rows in this section." }),
  },
  {
    required: ["rows"],
    description: "A report section with labelled rows.",
  },
);

const reportOutput = s.object(
  {
    report_id: s.string(),
    report_name: s.string(),
    titles: s.stringArray("The report titles."),
    generated_at: s.nullableString("When the report was generated (ISO 8601)."),
    sections: s.array(reportSection, { description: "The report body as labelled sections." }),
  },
  {
    required: ["report_id", "report_name", "titles", "sections"],
    description: "A financial report with labelled sections an agent can summarise.",
  },
);

const rawXeroObject = s.looseObject("The raw Xero Accounting API object.");
const rawXeroPage = (description: string) =>
  s.object(description, {
    items: s.array("The Xero records returned for this page.", rawXeroObject),
    page: pageOutput,
    returned: s.nonNegativeInteger("The number of records returned."),
  });

const searchResults = <T extends JsonSchema>(itemSchema: T, description: string) =>
  s.object(
    {
      items: s.array(itemSchema, { description }),
      page: pageOutput,
      returned: s.integer(),
    },
    {
      required: ["items", "page", "returned"],
      description: "A page of results.",
    },
  );

export const xeroActions: ActionDefinition[] = [
  defineProviderAction(service, {
    name: "list_organisations",
    description: "List the Xero organisations (tenants) connected to this account.",
    inputSchema: s.object({}, { description: "No input is required." }),
    outputSchema: s.object(
      {
        organisations: s.array(tenantSummary, { description: "The connected organisations." }),
      },
      {
        required: ["organisations"],
        description: "Connected Xero organisations.",
      },
    ),
  }),
  defineProviderAction(service, {
    name: "get_organisation",
    requiredScopes: [xeroSettingsReadScope],
    description: "Get the organisation profile for a tenant.",
    inputSchema: s.object(tenantField, { description: "Organisation lookup input." }),
    outputSchema: s.object(
      {
        organisation_id: xeroId,
        name: s.string(),
        legal_name: s.string(),
        currency_code: s.string(),
        country_code: s.string(),
        timezone: s.string(),
        tax_system_type: s.string(),
      },
      {
        required: ["organisation_id", "name", "legal_name", "currency_code", "country_code"],
        additionalProperties: true,
        description: "An organisation profile.",
      },
    ),
  }),
  defineProviderAction(service, {
    name: "search_contacts",
    requiredScopes: [xeroContactsReadScope],
    description: "Search contacts by name fragment with pagination.",
    inputSchema: s.object(
      {
        ...tenantField,
        search: s.string({ description: "A name fragment to match. When omitted, all contacts are returned." }),
        page: pageInput,
      },
      {
        description: "Contact search input.",
      },
    ),
    outputSchema: searchResults(contactSummary, "Matching contacts."),
  }),
  defineProviderAction(service, {
    name: "get_contact",
    requiredScopes: [xeroContactsReadScope],
    description: "Get a contact by ID.",
    inputSchema: s.object(
      { ...tenantField, contact_id: xeroId },
      { required: ["contact_id"], description: "Contact lookup input." },
    ),
    outputSchema: s.nullable(contactSummary),
  }),
  defineProviderAction(service, {
    name: "create_contact",
    requiredScopes: [xeroContactsWriteScope],
    description: "Create a contact. Requires a connection with the accounting.contacts scope.",
    inputSchema: s.object(
      {
        ...tenantField,
        name: s.string({ description: "The contact name." }),
        email_address: s.string({ description: "The contact email address." }),
        first_name: s.string({ description: "The contact first name." }),
        last_name: s.string({ description: "The contact last name." }),
      },
      {
        required: ["name"],
        description: "Contact creation input.",
      },
    ),
    outputSchema: s.object({ contact: contactSummary }, { required: ["contact"], description: "The created contact." }),
  }),
  defineProviderAction(service, {
    name: "search_invoices",
    requiredScopes: [xeroInvoicesReadScope],
    description: "Search invoices by status with pagination.",
    inputSchema: s.object(
      {
        ...tenantField,
        status: s.stringEnum(invoiceStatuses, { description: "Filter by invoice status." }),
        page: pageInput,
      },
      {
        description: "Invoice search input.",
      },
    ),
    outputSchema: searchResults(invoiceSummary, "Matching invoices."),
  }),
  defineProviderAction(service, {
    name: "get_invoice",
    requiredScopes: [xeroInvoicesReadScope],
    description: "Get an invoice with its line items by ID.",
    inputSchema: s.object(
      { ...tenantField, invoice_id: xeroId },
      { required: ["invoice_id"], description: "Invoice lookup input." },
    ),
    outputSchema: s.nullable(invoiceDetail),
  }),
  defineProviderAction(service, {
    name: "create_invoice",
    requiredScopes: [xeroInvoicesWriteScope],
    description: "Create an invoice for a contact. Requires a connection with the accounting.invoices scope.",
    inputSchema: s.object(
      {
        ...tenantField,
        contact_id: xeroId,
        type: s.stringEnum(["ACCREC", "ACCPAY"], {
          default: "ACCREC",
          description: "ACCREC bills the customer; ACCPAY records a bill from a supplier.",
        }),
        date: s.date("The invoice date. When omitted, Xero uses today in the organisation timezone."),
        due_date: s.date(
          "The due date. When omitted, a 30-day term is applied only when date is provided; otherwise Xero determines the date.",
        ),
        reference: s.string({ description: "The invoice reference." }),
        line_items: s.array(lineItemInput, { description: "The invoice line items." }),
      },
      {
        required: ["contact_id", "line_items"],
        description: "Invoice creation input.",
      },
    ),
    outputSchema: s.object({ invoice: invoiceDetail }, { required: ["invoice"], description: "The created invoice." }),
  }),
  defineProviderAction(service, {
    name: "update_invoice_status",
    requiredScopes: [xeroInvoicesWriteScope],
    description:
      "Move an invoice through its lifecycle: submit, approve, or void. Requires the accounting.invoices scope.",
    inputSchema: s.object(
      {
        ...tenantField,
        invoice_id: xeroId,
        status: s.stringEnum(["SUBMITTED", "AUTHORISED", "VOIDED"], {
          description: "The status to move the invoice to.",
        }),
      },
      {
        required: ["invoice_id", "status"],
        description: "Invoice status update input.",
      },
    ),
    outputSchema: s.object({ invoice: invoiceSummary }, { required: ["invoice"], description: "The updated invoice." }),
  }),
  defineProviderAction(service, {
    name: "list_accounts",
    requiredScopes: [xeroSettingsReadScope],
    description: "List the chart of accounts for a tenant.",
    inputSchema: s.object(
      {
        ...tenantField,
        status: s.stringEnum(accountStatuses, { description: "Filter by account status." }),
      },
      { description: "Account list input." },
    ),
    outputSchema: s.object(
      {
        accounts: s.array(accountSummary, { description: "The chart of accounts." }),
      },
      {
        required: ["accounts"],
        description: "The chart of accounts.",
      },
    ),
  }),
  defineProviderAction(service, {
    name: "get_account",
    requiredScopes: [xeroSettingsReadScope],
    description: "Get an account by ID.",
    inputSchema: s.object(
      { ...tenantField, account_id: xeroId },
      { required: ["account_id"], description: "Account lookup input." },
    ),
    outputSchema: s.nullable(accountSummary),
  }),
  defineProviderAction(service, {
    name: "search_bank_transactions",
    requiredScopes: [xeroBankTransactionsReadScope],
    description: "Search bank transactions, overpayments, prepayments, and transfers by status with pagination.",
    inputSchema: s.object(
      {
        ...tenantField,
        status: s.stringEnum(bankTransactionStatuses, { description: "Filter by transaction status." }),
        page: pageInput,
      },
      {
        description: "Bank transaction search input.",
      },
    ),
    outputSchema: searchResults(bankTransactionSummary, "Matching bank transactions."),
  }),
  defineProviderAction(service, {
    name: "get_bank_transaction",
    requiredScopes: [xeroBankTransactionsReadScope],
    description: "Get a bank transaction with its line items by ID.",
    inputSchema: s.object(
      { ...tenantField, bank_transaction_id: xeroId },
      { required: ["bank_transaction_id"], description: "Bank transaction lookup input." },
    ),
    outputSchema: s.nullable(bankTransactionDetail),
  }),
  defineProviderAction(service, {
    name: "get_profit_and_loss",
    requiredScopes: [xeroProfitAndLossReadScope],
    description: "Get the profit and loss report for a tenant, as labelled sections an agent can summarise.",
    inputSchema: s.object(
      {
        ...tenantField,
        from_date: s.date("The report start date."),
        to_date: s.date("The report end date. Defaults to today."),
      },
      { description: "Profit and loss report input." },
    ),
    outputSchema: reportOutput,
  }),
  defineProviderAction(service, {
    name: "get_balance_sheet",
    requiredScopes: [xeroBalanceSheetReadScope],
    description: "Get the balance sheet report for a tenant, as labelled sections an agent can summarise.",
    inputSchema: s.object(
      {
        ...tenantField,
        date: s.date("The as-at date for the balance sheet. Defaults to today in the organisation timezone."),
      },
      { description: "Balance sheet report input." },
    ),
    outputSchema: reportOutput,
  }),
  defineProviderAction(service, {
    name: "list_payments",
    requiredScopes: [xeroPaymentsReadScope],
    description:
      "List payments applied to invoices, credit notes, overpayments, or prepayments. Deleted payments are excluded by default.",
    inputSchema: s.object(
      {
        ...tenantField,
        page: pageInput,
        invoice_number: s.string("Filter by exact invoice number."),
        invoice_id: xeroId,
        payment_id: xeroId,
        reference: s.string("Filter by exact payment reference."),
        include_deleted: s.boolean("Whether to include deleted payments, which are excluded by default."),
        page_size: s.integer("The page size, up to Xero's 1000-record maximum.", {
          minimum: 1,
          maximum: 1000,
        }),
      },
      {
        optional: [
          "tenant_id",
          "page",
          "invoice_number",
          "invoice_id",
          "payment_id",
          "reference",
          "include_deleted",
          "page_size",
        ],
        description: "Payment list input.",
      },
    ),
    outputSchema: rawXeroPage("A page of Xero payments."),
  }),
  defineProviderAction(service, {
    name: "get_payment",
    requiredScopes: [xeroPaymentsReadScope],
    description: "Get one Xero payment by ID.",
    inputSchema: s.object(
      { ...tenantField, payment_id: xeroId },
      { required: ["payment_id"], description: "Payment lookup input." },
    ),
    outputSchema: s.nullable(rawXeroObject),
  }),
  defineProviderAction(service, {
    name: "list_quotes",
    requiredScopes: [xeroInvoicesReadScope],
    description: "List Xero quotes with optional status, contact, and page filters.",
    inputSchema: s.object(
      {
        ...tenantField,
        status: s.stringEnum(["DRAFT", "SENT", "DECLINED", "ACCEPTED", "INVOICED", "DELETED"], {
          description: "Filter by quote status.",
        }),
        contact_id: xeroId,
        quote_number: s.string("Filter by exact quote number."),
        page: pageInput,
      },
      {
        optional: ["tenant_id", "status", "contact_id", "quote_number", "page"],
        description: "Quote list input.",
      },
    ),
    outputSchema: rawXeroPage("A page of Xero quotes."),
  }),
  defineProviderAction(service, {
    name: "get_quote",
    requiredScopes: [xeroInvoicesReadScope],
    description: "Get one Xero quote by ID.",
    inputSchema: s.object(
      { ...tenantField, quote_id: xeroId },
      { required: ["quote_id"], description: "Quote lookup input." },
    ),
    outputSchema: s.nullable(rawXeroObject),
  }),
  defineProviderAction(service, {
    name: "list_purchase_orders",
    requiredScopes: [xeroInvoicesReadScope],
    description: "List Xero purchase orders with optional status, date, and page filters.",
    inputSchema: s.object(
      {
        ...tenantField,
        status: s.stringEnum(["DRAFT", "SUBMITTED", "AUTHORISED", "BILLED", "DELETED"], {
          description: "Filter by purchase-order status.",
        }),
        date_from: s.date("Inclusive purchase-order date lower bound."),
        date_to: s.date("Inclusive purchase-order date upper bound."),
        page: pageInput,
        page_size: s.integer("The page size.", { minimum: 1, maximum: 1000 }),
      },
      {
        optional: ["tenant_id", "status", "date_from", "date_to", "page", "page_size"],
        description: "Purchase-order list input.",
      },
    ),
    outputSchema: rawXeroPage("A page of Xero purchase orders."),
  }),
  defineProviderAction(service, {
    name: "get_purchase_order",
    requiredScopes: [xeroInvoicesReadScope],
    description: "Get one Xero purchase order by ID.",
    inputSchema: s.object(
      { ...tenantField, purchase_order_id: xeroId },
      { required: ["purchase_order_id"], description: "Purchase-order lookup input." },
    ),
    outputSchema: s.nullable(rawXeroObject),
  }),
  defineProviderAction(service, {
    name: "list_items",
    requiredScopes: [xeroSettingsReadScope],
    description: "List tracked and untracked Xero inventory items.",
    inputSchema: s.object(tenantField, { optional: ["tenant_id"], description: "Item list input." }),
    outputSchema: s.object("The Xero inventory items.", {
      items: s.array("The inventory items returned by Xero.", rawXeroObject),
      returned: s.nonNegativeInteger("The number of inventory items returned."),
    }),
  }),
  defineProviderAction(service, {
    name: "get_item",
    requiredScopes: [xeroSettingsReadScope],
    description: "Get one Xero inventory item by ID or code.",
    inputSchema: s.object(
      { ...tenantField, item_id: s.nonEmptyString("The Xero ItemID or item code.") },
      { required: ["item_id"], description: "Item lookup input." },
    ),
    outputSchema: s.nullable(rawXeroObject),
  }),
  defineProviderAction(service, {
    name: "list_journals",
    requiredScopes: [xeroJournalsReadScope],
    description:
      "List up to 100 general-ledger journals after a journal-number offset, oldest first. These are system journals, not manual journals.",
    inputSchema: s.object(
      {
        ...tenantField,
        offset: s.nonNegativeInteger("Return journals after this journal number."),
        payments_only: s.boolean("Whether to return only cash-basis payment journals."),
      },
      { optional: ["tenant_id", "offset", "payments_only"], description: "Journal list input." },
    ),
    outputSchema: s.object("A page of Xero journals.", {
      items: s.array("The journals returned by Xero.", rawXeroObject),
      returned: s.nonNegativeInteger("The number of journals returned."),
      next_offset: s.nullableInteger("The last journal number, used to fetch the next page."),
    }),
  }),
  defineProviderAction(service, {
    name: "get_journal",
    requiredScopes: [xeroJournalsReadScope],
    description: "Get one Xero general-ledger journal by ID.",
    inputSchema: s.object(
      { ...tenantField, journal_id: xeroId },
      { required: ["journal_id"], description: "Journal lookup input." },
    ),
    outputSchema: s.nullable(rawXeroObject),
  }),
  defineProviderAction(service, {
    name: "list_tax_rates",
    requiredScopes: [xeroSettingsReadScope],
    description: "List tax rates configured for a Xero organisation.",
    inputSchema: s.object(tenantField, { optional: ["tenant_id"], description: "Tax-rate list input." }),
    outputSchema: s.object("The Xero tax rates.", {
      tax_rates: s.array("Tax rates configured in the organisation.", rawXeroObject),
    }),
  }),
  defineProviderAction(service, {
    name: "list_tracking_categories",
    requiredScopes: [xeroSettingsReadScope],
    description: "List Xero tracking categories and their options.",
    inputSchema: s.object(
      { ...tenantField, include_archived: s.boolean("Whether to include archived categories and options.") },
      { optional: ["tenant_id", "include_archived"], description: "Tracking-category list input." },
    ),
    outputSchema: s.object("The Xero tracking categories.", {
      tracking_categories: s.array("Tracking categories configured in the organisation.", rawXeroObject),
    }),
  }),
];
