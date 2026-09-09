import type { ActionDefinition } from "../../core/types.ts";

import { s } from "../../core/json-schema.ts";
import { defineProviderAction } from "../../core/provider-definition.ts";
import {
  xeroIdempotencyKey,
  xeroAccountProperties,
  xeroBankTransactionProperties,
  xeroCreditNoteProperties,
  xeroItemProperties,
  xeroManualJournalProperties,
  xeroPurchaseOrderProperties,
  xeroQuoteProperties,
  xeroRepeatingInvoiceProperties,
  xeroContactProperties,
  xeroInvoiceProperties,
  xeroLinkedTransactionProperties,
} from "./accounting-schemas.ts";
export const xeroAccountingWriteActions: ActionDefinition[] = [
  {
    name: "create_account",
    description: "Create a Xero account.",
    requiredScopes: ["accounting.settings"],
    inputSchema: s.object(
      {
        tenant_id: s.uuid("The connected organisation ID."),
        ...xeroAccountProperties,
        idempotency_key: xeroIdempotencyKey,
      },
      { required: ["code", "name", "type"] },
    ),
    outputSchema: s.looseObject(
      "The Xero response, including provider validation details and pagination when returned.",
    ),
  },
  {
    name: "create_bank_transaction",
    description: "Create a Xero bank transaction. Defaults to AUTHORISED.",
    requiredScopes: ["accounting.banktransactions"],
    inputSchema: s.object(
      {
        tenant_id: s.uuid("The connected organisation ID."),
        ...xeroBankTransactionProperties,
        idempotency_key: xeroIdempotencyKey,
      },
      { required: ["type", "bank_account_id", "contact_id", "line_items"] },
    ),
    outputSchema: s.looseObject(
      "The Xero response, including provider validation details and pagination when returned.",
    ),
  },
  {
    name: "create_credit_note",
    description: "Create a Xero credit note. Defaults to DRAFT.",
    requiredScopes: ["accounting.invoices"],
    inputSchema: s.object(
      {
        tenant_id: s.uuid("The connected organisation ID."),
        ...xeroCreditNoteProperties,
        status: s.stringEnum(["DRAFT", "AUTHORISED"]),
        idempotency_key: xeroIdempotencyKey,
      },
      { required: ["type", "contact_id", "line_items"] },
    ),
    outputSchema: s.looseObject(
      "The Xero response, including provider validation details and pagination when returned.",
    ),
  },
  {
    name: "create_item",
    description: "Create a Xero item.",
    requiredScopes: ["accounting.settings"],
    inputSchema: s.object(
      {
        tenant_id: s.uuid("The connected organisation ID."),
        ...xeroItemProperties,
        idempotency_key: xeroIdempotencyKey,
      },
      { required: ["code"] },
    ),
    outputSchema: s.looseObject(
      "The Xero response, including provider validation details and pagination when returned.",
    ),
  },
  {
    name: "create_manual_journal",
    description: "Create a Xero manual journal. Defaults to DRAFT.",
    requiredScopes: ["accounting.manualjournals"],
    inputSchema: s.object(
      {
        tenant_id: s.uuid("The connected organisation ID."),
        ...xeroManualJournalProperties,
        status: s.stringEnum(["DRAFT", "POSTED"]),
        idempotency_key: xeroIdempotencyKey,
      },
      { required: ["narration", "journal_lines"] },
    ),
    outputSchema: s.looseObject(
      "The Xero response, including provider validation details and pagination when returned.",
    ),
  },
  {
    name: "create_purchase_order",
    description: "Create a Xero purchase order. Defaults to DRAFT.",
    requiredScopes: ["accounting.invoices"],
    inputSchema: s.object(
      {
        tenant_id: s.uuid("The connected organisation ID."),
        ...xeroPurchaseOrderProperties,
        status: s.stringEnum(["DRAFT", "SUBMITTED", "AUTHORISED"]),
        idempotency_key: xeroIdempotencyKey,
      },
      { required: ["contact_id", "line_items"] },
    ),
    outputSchema: s.looseObject(
      "The Xero response, including provider validation details and pagination when returned.",
    ),
  },
  {
    name: "create_quote",
    description: "Create a Xero quote. Defaults to DRAFT.",
    requiredScopes: ["accounting.invoices"],
    inputSchema: s.object(
      {
        tenant_id: s.uuid("The connected organisation ID."),
        ...xeroQuoteProperties,
        status: s.stringEnum(["DRAFT", "SENT"]),
        idempotency_key: xeroIdempotencyKey,
      },
      { required: ["contact_id", "line_items"] },
    ),
    outputSchema: s.looseObject(
      "The Xero response, including provider validation details and pagination when returned.",
    ),
  },
  {
    name: "create_repeating_invoice",
    description: "Create a Xero repeating invoice. Defaults to DRAFT.",
    requiredScopes: ["accounting.invoices"],
    inputSchema: s.object(
      {
        tenant_id: s.uuid("The connected organisation ID."),
        ...xeroRepeatingInvoiceProperties,
        status: s.stringEnum(["DRAFT", "AUTHORISED"]),
        idempotency_key: xeroIdempotencyKey,
      },
      { required: ["type", "contact_id", "line_items", "schedule"] },
    ),
    outputSchema: s.looseObject(
      "The Xero response, including provider validation details and pagination when returned.",
    ),
  },
  {
    name: "update_account",
    description: "Update a Xero account.",
    requiredScopes: ["accounting.settings"],
    inputSchema: s.object(
      {
        tenant_id: s.uuid("The connected organisation ID."),
        account_id: s.uuid("The Xero resource ID."),
        ...xeroAccountProperties,
        status: s.stringEnum(["ACTIVE", "ARCHIVED"]),
        idempotency_key: xeroIdempotencyKey,
      },
      { required: ["account_id"] },
    ),
    outputSchema: s.looseObject(
      "The Xero response, including provider validation details and pagination when returned.",
    ),
  },
  {
    name: "update_bank_transaction",
    description: "Update a Xero bank transaction. Supplied lines replace the entire line set.",
    requiredScopes: ["accounting.banktransactions"],
    inputSchema: s.object(
      {
        tenant_id: s.uuid("The connected organisation ID."),
        bank_transaction_id: s.uuid("The Xero resource ID."),
        ...xeroBankTransactionProperties,
        idempotency_key: xeroIdempotencyKey,
      },
      { required: ["bank_transaction_id"] },
    ),
    outputSchema: s.looseObject(
      "The Xero response, including provider validation details and pagination when returned.",
    ),
  },
  {
    name: "update_contact",
    description: "Update a Xero contact.",
    requiredScopes: ["accounting.contacts"],
    inputSchema: s.object(
      {
        tenant_id: s.uuid("The connected organisation ID."),
        contact_id: s.uuid("The Xero resource ID."),
        ...xeroContactProperties,
        status: s.stringEnum(["ACTIVE", "ARCHIVED"]),
        idempotency_key: xeroIdempotencyKey,
      },
      { required: ["contact_id"] },
    ),
    outputSchema: s.looseObject(
      "The Xero response, including provider validation details and pagination when returned.",
    ),
  },
  {
    name: "update_credit_note",
    description:
      "Update a Xero credit note. Financial edits are deliberately limited to DRAFT documents. Supplied lines replace the entire line set.",
    requiredScopes: ["accounting.invoices"],
    inputSchema: s.object(
      {
        tenant_id: s.uuid("The connected organisation ID."),
        credit_note_id: s.uuid("The Xero resource ID."),
        ...xeroCreditNoteProperties,
        idempotency_key: xeroIdempotencyKey,
      },
      { required: ["credit_note_id"] },
    ),
    outputSchema: s.looseObject(
      "The Xero response, including provider validation details and pagination when returned.",
    ),
  },
  {
    name: "update_invoice",
    description:
      "Update a Xero invoice. Financial edits are deliberately limited to DRAFT documents. Supplied lines replace the entire line set.",
    requiredScopes: ["accounting.invoices"],
    inputSchema: s.object(
      {
        tenant_id: s.uuid("The connected organisation ID."),
        invoice_id: s.uuid("The Xero resource ID."),
        ...xeroInvoiceProperties,
        idempotency_key: xeroIdempotencyKey,
      },
      { required: ["invoice_id"] },
    ),
    outputSchema: s.looseObject(
      "The Xero response, including provider validation details and pagination when returned.",
    ),
  },
  {
    name: "update_item",
    description: "Update a Xero item.",
    requiredScopes: ["accounting.settings"],
    inputSchema: s.object(
      {
        tenant_id: s.uuid("The connected organisation ID."),
        item_id: s.uuid("The Xero resource ID."),
        ...xeroItemProperties,
        idempotency_key: xeroIdempotencyKey,
      },
      { required: ["item_id"] },
    ),
    outputSchema: s.looseObject(
      "The Xero response, including provider validation details and pagination when returned.",
    ),
  },
  {
    name: "update_linked_transaction",
    description: "Update a Xero linked transaction.",
    requiredScopes: ["accounting.invoices"],
    inputSchema: s.object(
      {
        tenant_id: s.uuid("The connected organisation ID."),
        linked_transaction_id: s.uuid("The Xero resource ID."),
        ...xeroLinkedTransactionProperties,
        idempotency_key: xeroIdempotencyKey,
      },
      { required: ["linked_transaction_id"] },
    ),
    outputSchema: s.looseObject(
      "The Xero response, including provider validation details and pagination when returned.",
    ),
  },
  {
    name: "update_manual_journal",
    description:
      "Update a Xero manual journal. Financial edits are deliberately limited to DRAFT documents. Supplied lines replace the entire line set.",
    requiredScopes: ["accounting.manualjournals"],
    inputSchema: s.object(
      {
        tenant_id: s.uuid("The connected organisation ID."),
        manual_journal_id: s.uuid("The Xero resource ID."),
        ...xeroManualJournalProperties,
        idempotency_key: xeroIdempotencyKey,
      },
      { required: ["manual_journal_id"] },
    ),
    outputSchema: s.looseObject(
      "The Xero response, including provider validation details and pagination when returned.",
    ),
  },
  {
    name: "update_purchase_order",
    description:
      "Update a Xero purchase order. Financial edits are deliberately limited to DRAFT documents. Supplied lines replace the entire line set.",
    requiredScopes: ["accounting.invoices"],
    inputSchema: s.object(
      {
        tenant_id: s.uuid("The connected organisation ID."),
        purchase_order_id: s.uuid("The Xero resource ID."),
        ...xeroPurchaseOrderProperties,
        idempotency_key: xeroIdempotencyKey,
      },
      { required: ["purchase_order_id"] },
    ),
    outputSchema: s.looseObject(
      "The Xero response, including provider validation details and pagination when returned.",
    ),
  },
  {
    name: "update_quote",
    description:
      "Update a Xero quote. Financial edits are deliberately limited to DRAFT documents. Supplied lines replace the entire line set.",
    requiredScopes: ["accounting.invoices"],
    inputSchema: s.object(
      {
        tenant_id: s.uuid("The connected organisation ID."),
        quote_id: s.uuid("The Xero resource ID."),
        ...xeroQuoteProperties,
        idempotency_key: xeroIdempotencyKey,
      },
      { required: ["quote_id"] },
    ),
    outputSchema: s.looseObject(
      "The Xero response, including provider validation details and pagination when returned.",
    ),
  },
  {
    name: "archive_account",
    description: "Archive an account; existing transactions are retained.",
    requiredScopes: ["accounting.settings"],
    inputSchema: s.object(
      {
        tenant_id: s.uuid("The connected organisation ID."),
        account_id: s.uuid("The Xero resource ID."),
        idempotency_key: xeroIdempotencyKey,
      },
      { required: ["account_id"] },
    ),
    outputSchema: s.looseObject(
      "The Xero response, including provider validation details and pagination when returned.",
    ),
  },
  {
    name: "create_bank_transfer",
    description: "Transfer a positive amount between two distinct bank accounts.",
    requiredScopes: ["accounting.banktransactions"],
    inputSchema: s.object(
      {
        tenant_id: s.uuid("The connected organisation ID."),
        from_bank_account_id: s.uuid("The Xero resource ID."),
        to_bank_account_id: s.uuid("The Xero resource ID."),
        amount: s.number({ exclusiveMinimum: 0 }),
        date: s.date("Calendar date (YYYY-MM-DD)."),
        reference: s.string(),
        currency_rate: s.number({ exclusiveMinimum: 0 }),
        idempotency_key: xeroIdempotencyKey,
      },
      { required: ["from_bank_account_id", "to_bank_account_id", "amount"] },
    ),
    outputSchema: s.looseObject(
      "The Xero response, including provider validation details and pagination when returned.",
    ),
  },
  {
    name: "create_contact_history_note",
    description: "Add a history note to a contact.",
    requiredScopes: ["accounting.contacts"],
    inputSchema: s.object(
      {
        tenant_id: s.uuid("The connected organisation ID."),
        contact_id: s.uuid("The Xero resource ID."),
        details: s.nonEmptyString("A non-empty value."),
        idempotency_key: xeroIdempotencyKey,
      },
      { required: ["contact_id", "details"] },
    ),
    outputSchema: s.looseObject(
      "The Xero response, including provider validation details and pagination when returned.",
    ),
  },
  {
    name: "create_invoice_history_note",
    description: "Add a history note to a invoice.",
    requiredScopes: ["accounting.invoices"],
    inputSchema: s.object(
      {
        tenant_id: s.uuid("The connected organisation ID."),
        invoice_id: s.uuid("The Xero resource ID."),
        details: s.nonEmptyString("A non-empty value."),
        idempotency_key: xeroIdempotencyKey,
      },
      { required: ["invoice_id", "details"] },
    ),
    outputSchema: s.looseObject(
      "The Xero response, including provider validation details and pagination when returned.",
    ),
  },
  {
    name: "create_currency",
    description: "Enable an ISO currency for this organisation.",
    requiredScopes: ["accounting.settings"],
    inputSchema: s.object(
      {
        tenant_id: s.uuid("The connected organisation ID."),
        code: s.string({ pattern: "^[A-Z]{3}$" }),
        description: s.string(),
        idempotency_key: xeroIdempotencyKey,
      },
      { required: ["code"] },
    ),
    outputSchema: s.looseObject(
      "The Xero response, including provider validation details and pagination when returned.",
    ),
  },
  {
    name: "create_linked_transaction",
    description: "Create a billable-expense link from a source transaction and line.",
    requiredScopes: ["accounting.invoices"],
    inputSchema: s.object(
      {
        tenant_id: s.uuid("The connected organisation ID."),
        ...xeroLinkedTransactionProperties,
        idempotency_key: xeroIdempotencyKey,
      },
      { required: ["source_transaction_id", "source_line_item_id"] },
    ),
    outputSchema: s.looseObject(
      "The Xero response, including provider validation details and pagination when returned.",
    ),
  },
  {
    name: "create_payment",
    description:
      "Pay an authorised, unsettled invoice. Amount is in invoice currency; bank_amount is the optional bank-currency amount for FX payments.",
    requiredScopes: ["accounting.payments"],
    inputSchema: s.object(
      {
        tenant_id: s.uuid("The connected organisation ID."),
        invoice_id: s.uuid("The Xero resource ID."),
        account_id: s.uuid("The Xero resource ID."),
        amount: s.number({ exclusiveMinimum: 0 }),
        bank_amount: s.number({ exclusiveMinimum: 0 }),
        currency_rate: s.number({ exclusiveMinimum: 0 }),
        date: s.date("Calendar date (YYYY-MM-DD)."),
        reference: s.string(),
        idempotency_key: xeroIdempotencyKey,
      },
      { required: ["invoice_id", "account_id", "amount", "date"] },
    ),
    outputSchema: s.looseObject(
      "The Xero response, including provider validation details and pagination when returned.",
    ),
  },
  {
    name: "create_tracking_category",
    description: "Create an active tracking category.",
    requiredScopes: ["accounting.settings"],
    inputSchema: s.object(
      {
        tenant_id: s.uuid("The connected organisation ID."),
        name: s.nonEmptyString("The category name.", { maxLength: 100 }),
        idempotency_key: xeroIdempotencyKey,
      },
      { required: ["name"] },
    ),
    outputSchema: s.looseObject(
      "The Xero response, including provider validation details and pagination when returned.",
    ),
  },
  {
    name: "update_tracking_category",
    description: "Rename or archive a tracking category.",
    requiredScopes: ["accounting.settings"],
    inputSchema: s.object(
      {
        tenant_id: s.uuid("The connected organisation ID."),
        tracking_category_id: s.uuid("The Xero resource ID."),
        name: s.nonEmptyString("A non-empty value."),
        status: s.stringEnum(["ACTIVE", "ARCHIVED"]),
        idempotency_key: xeroIdempotencyKey,
      },
      { required: ["tracking_category_id"] },
    ),
    outputSchema: s.looseObject(
      "The Xero response, including provider validation details and pagination when returned.",
    ),
  },
  {
    name: "create_tracking_options",
    description:
      "Create up to ten tracking options sequentially. Returns each result; stops after a transport or server failure and retains prior outcomes.",
    requiredScopes: ["accounting.settings"],
    inputSchema: s.object(
      {
        tenant_id: s.uuid("The connected organisation ID."),
        tracking_category_id: s.uuid("The Xero resource ID."),
        names: s.array(s.nonEmptyString("A non-empty value."), { minItems: 1, maxItems: 10 }),
        idempotency_key: xeroIdempotencyKey,
      },
      { required: ["tracking_category_id", "names"] },
    ),
    outputSchema: s.looseObject(
      "The Xero response, including provider validation details and pagination when returned.",
    ),
  },
  {
    name: "update_tracking_options",
    description:
      "Rename or archive up to ten tracking options. Returns each result; stops after a transport or server failure and retains prior outcomes.",
    requiredScopes: ["accounting.settings"],
    inputSchema: s.object(
      {
        tenant_id: s.uuid("The connected organisation ID."),
        tracking_category_id: s.uuid("The Xero resource ID."),
        options: s.array(
          s.object(
            {
              tracking_option_id: s.uuid("The option ID."),
              name: s.nonEmptyString("The new name."),
              status: s.stringEnum(["ACTIVE", "ARCHIVED"]),
            },
            { required: ["tracking_option_id"] },
          ),
          { minItems: 1, maxItems: 10 },
        ),
        idempotency_key: xeroIdempotencyKey,
      },
      { required: ["tracking_category_id", "options"] },
    ),
    outputSchema: s.looseObject(
      "The Xero response, including provider validation details and pagination when returned.",
    ),
  },
  {
    name: "delete_draft_invoice",
    description: "Delete a invoice by setting its Xero status. Requires DRAFT or SUBMITTED.",
    requiredScopes: ["accounting.invoices"],
    inputSchema: s.object(
      {
        tenant_id: s.uuid("The connected organisation ID."),
        invoice_id: s.uuid("The Xero resource ID."),
        idempotency_key: xeroIdempotencyKey,
      },
      { required: ["invoice_id"] },
    ),
    outputSchema: s.looseObject(
      "The Xero response, including provider validation details and pagination when returned.",
    ),
  },
  {
    name: "void_manual_journal",
    description: "Void a manual journal by setting its Xero status. Requires POSTED.",
    requiredScopes: ["accounting.manualjournals"],
    inputSchema: s.object(
      {
        tenant_id: s.uuid("The connected organisation ID."),
        manual_journal_id: s.uuid("The Xero resource ID."),
        idempotency_key: xeroIdempotencyKey,
      },
      { required: ["manual_journal_id"] },
    ),
    outputSchema: s.looseObject(
      "The Xero response, including provider validation details and pagination when returned.",
    ),
  },
  {
    name: "delete_payment",
    description: "Delete a payment by setting its Xero status. Requires AUTHORISED.",
    requiredScopes: ["accounting.payments"],
    inputSchema: s.object(
      {
        tenant_id: s.uuid("The connected organisation ID."),
        payment_id: s.uuid("The Xero resource ID."),
        idempotency_key: xeroIdempotencyKey,
      },
      { required: ["payment_id"] },
    ),
    outputSchema: s.looseObject(
      "The Xero response, including provider validation details and pagination when returned.",
    ),
  },
  {
    name: "delete_linked_transaction",
    description: "Delete a billable-expense link.",
    requiredScopes: ["accounting.invoices"],
    inputSchema: s.object(
      {
        tenant_id: s.uuid("The connected organisation ID."),
        linked_transaction_id: s.uuid("The Xero resource ID."),
        idempotency_key: xeroIdempotencyKey,
      },
      { required: ["linked_transaction_id"] },
    ),
    outputSchema: s.looseObject(
      "The Xero response, including provider validation details and pagination when returned.",
    ),
  },
  {
    name: "batch_create_contacts",
    description:
      "Create or update 1–50 contacts. Xero may update matching records. Preserves per-record validation errors and warnings; no automatic retry.",
    requiredScopes: ["accounting.contacts"],
    inputSchema: s.object(
      {
        tenant_id: s.uuid("The connected organisation ID."),
        contacts: s.array(s.object(xeroContactProperties, { required: ["name"] }), { minItems: 1, maxItems: 50 }),
        idempotency_key: xeroIdempotencyKey,
      },
      { required: ["contacts"] },
    ),
    outputSchema: s.looseObject(
      "The Xero response, including provider validation details and pagination when returned.",
    ),
  },
  {
    name: "batch_create_invoices",
    description:
      "Create or update 1–50 invoices. Xero may update matching records. Preserves per-record validation errors and warnings; no automatic retry.",
    requiredScopes: ["accounting.invoices"],
    inputSchema: s.object(
      {
        tenant_id: s.uuid("The connected organisation ID."),
        invoices: s.array(s.object(xeroInvoiceProperties, { required: ["type", "contact_id", "line_items"] }), {
          minItems: 1,
          maxItems: 50,
        }),
        idempotency_key: xeroIdempotencyKey,
      },
      { required: ["invoices"] },
    ),
    outputSchema: s.looseObject(
      "The Xero response, including provider validation details and pagination when returned.",
    ),
  },
].map((action) => defineProviderAction("xero", action));
