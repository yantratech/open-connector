import type { ProviderActionHandlerSubset, ProviderRuntimeHandler, OAuthProviderContext } from "../provider-runtime.ts";

import { optionalString } from "../../core/cast.ts";
import { compactObject, objectArray, optionalNumber } from "../../core/cast.ts";
import { providerInputError } from "../provider-runtime.ts";
import { requiredInputString, providerResponseError } from "../provider-runtime.ts";
import {
  mapXeroAccount,
  mapXeroBankTransaction,
  mapXeroCreditNote,
  mapXeroItem,
  mapXeroManualJournal,
  mapXeroPurchaseOrder,
  mapXeroQuote,
  mapXeroRepeatingInvoice,
  mapXeroContact,
  mapXeroInvoice,
  mapXeroLinkedTransaction,
} from "./runtime-accounting-input.ts";
import {
  readXeroAccountingRecord,
  assertXeroStatus,
  validateXeroLines,
  validateXeroJournal,
  xeroBatchResult,
  assertXeroUpdate,
} from "./runtime-accounting-validation.ts";
import { xeroRequest, resolveTenantId, requireXeroGuid } from "./runtime-request.ts";
import { writeXeroTrackingOptions } from "./runtime-tracking.ts";
export const xeroAccountingWriteHandlers: ProviderActionHandlerSubset<
  "xero",
  ProviderRuntimeHandler<OAuthProviderContext>
> = {
  async create_account(input, context) {
    const tenantId = await resolveTenantId(input, context);
    const body = mapXeroAccount(input);
    return xeroRequest(context, {
      tenantId,
      path: "/Accounts",
      method: "PUT",
      idempotencyKey: optionalString(input.idempotency_key),
      body,
    });
  },
  async create_bank_transaction(input, context) {
    const tenantId = await resolveTenantId(input, context);
    validateXeroLines(input, true);
    const body = mapXeroBankTransaction(input);
    body.Status = optionalString(input.status) ?? "AUTHORISED";
    return xeroRequest(context, {
      tenantId,
      path: "/BankTransactions",
      method: "PUT",
      idempotencyKey: optionalString(input.idempotency_key),
      body: { BankTransactions: [body] },
    });
  },
  async create_credit_note(input, context) {
    const tenantId = await resolveTenantId(input, context);
    validateXeroLines(input, true);
    const body = mapXeroCreditNote(input);
    body.Status = optionalString(input.status) ?? "DRAFT";
    return xeroRequest(context, {
      tenantId,
      path: "/CreditNotes",
      method: "PUT",
      idempotencyKey: optionalString(input.idempotency_key),
      body: { CreditNotes: [body] },
    });
  },
  async create_item(input, context) {
    const tenantId = await resolveTenantId(input, context);
    const body = mapXeroItem(input);
    return xeroRequest(context, {
      tenantId,
      path: "/Items",
      method: "PUT",
      idempotencyKey: optionalString(input.idempotency_key),
      body: { Items: [body] },
    });
  },
  async create_manual_journal(input, context) {
    const tenantId = await resolveTenantId(input, context);
    validateXeroJournal(input, true);
    const body = mapXeroManualJournal(input);
    body.Status = optionalString(input.status) ?? "DRAFT";
    return xeroRequest(context, {
      tenantId,
      path: "/ManualJournals",
      method: "PUT",
      idempotencyKey: optionalString(input.idempotency_key),
      body: { ManualJournals: [body] },
    });
  },
  async create_purchase_order(input, context) {
    const tenantId = await resolveTenantId(input, context);
    validateXeroLines(input, true);
    const body = mapXeroPurchaseOrder(input);
    body.Status = optionalString(input.status) ?? "DRAFT";
    return xeroRequest(context, {
      tenantId,
      path: "/PurchaseOrders",
      method: "PUT",
      idempotencyKey: optionalString(input.idempotency_key),
      body: { PurchaseOrders: [body] },
    });
  },
  async create_quote(input, context) {
    const tenantId = await resolveTenantId(input, context);
    validateXeroLines(input, true);
    const body = mapXeroQuote(input);
    body.Status = optionalString(input.status) ?? "DRAFT";
    return xeroRequest(context, {
      tenantId,
      path: "/Quotes",
      method: "PUT",
      idempotencyKey: optionalString(input.idempotency_key),
      body: { Quotes: [body] },
    });
  },
  async create_repeating_invoice(input, context) {
    const tenantId = await resolveTenantId(input, context);
    validateXeroLines(input, true);
    const body = mapXeroRepeatingInvoice(input);
    body.Status = optionalString(input.status) ?? "DRAFT";
    return xeroRequest(context, {
      tenantId,
      path: "/RepeatingInvoices",
      method: "PUT",
      idempotencyKey: optionalString(input.idempotency_key),
      body: { RepeatingInvoices: [body] },
    });
  },
  async update_account(input, context) {
    const tenantId = await resolveTenantId(input, context);
    const id = requireXeroGuid(input.account_id, "account_id");
    const body = mapXeroAccount(input);
    if (input.status !== undefined) body.Status = input.status;
    assertXeroUpdate(body);
    body.AccountID = id;
    return xeroRequest(context, {
      tenantId,
      path: `/Accounts/${id}`,
      method: "POST",
      idempotencyKey: optionalString(input.idempotency_key),
      body: { Accounts: [body] },
    });
  },
  async update_bank_transaction(input, context) {
    const tenantId = await resolveTenantId(input, context);
    const id = requireXeroGuid(input.bank_transaction_id, "bank_transaction_id");
    const body = mapXeroBankTransaction(input);
    assertXeroUpdate(body);
    validateXeroLines(input);
    const current = await readXeroAccountingRecord(context, tenantId, "BankTransactions", id);
    assertXeroStatus(current, ["AUTHORISED"], "update_bank_transaction");
    if (current.IsReconciled === true)
      throw providerInputError("Reconciled bank transactions cannot be edited by this action.");
    body.BankTransactionID = id;
    return xeroRequest(context, {
      tenantId,
      path: `/BankTransactions/${id}`,
      method: "POST",
      idempotencyKey: optionalString(input.idempotency_key),
      body: { BankTransactions: [body] },
    });
  },
  async update_contact(input, context) {
    const tenantId = await resolveTenantId(input, context);
    const id = requireXeroGuid(input.contact_id, "contact_id");
    const body = mapXeroContact(input);
    if (input.status !== undefined) body.ContactStatus = input.status;
    assertXeroUpdate(body);
    body.ContactID = id;
    return xeroRequest(context, {
      tenantId,
      path: `/Contacts/${id}`,
      method: "POST",
      idempotencyKey: optionalString(input.idempotency_key),
      body: { Contacts: [body] },
    });
  },
  async update_credit_note(input, context) {
    const tenantId = await resolveTenantId(input, context);
    const id = requireXeroGuid(input.credit_note_id, "credit_note_id");
    const body = mapXeroCreditNote(input);
    assertXeroUpdate(body);
    validateXeroLines(input);
    const current = await readXeroAccountingRecord(context, tenantId, "CreditNotes", id);
    assertXeroStatus(current, ["DRAFT"], "update_credit_note");
    body.CreditNoteID = id;
    return xeroRequest(context, {
      tenantId,
      path: `/CreditNotes/${id}`,
      method: "POST",
      idempotencyKey: optionalString(input.idempotency_key),
      body: { CreditNotes: [body] },
    });
  },
  async update_invoice(input, context) {
    const tenantId = await resolveTenantId(input, context);
    const id = requireXeroGuid(input.invoice_id, "invoice_id");
    const body = mapXeroInvoice(input);
    assertXeroUpdate(body);
    validateXeroLines(input);
    const current = await readXeroAccountingRecord(context, tenantId, "Invoices", id);
    assertXeroStatus(current, ["DRAFT"], "update_invoice");
    body.InvoiceID = id;
    return xeroRequest(context, {
      tenantId,
      path: `/Invoices/${id}`,
      method: "POST",
      idempotencyKey: optionalString(input.idempotency_key),
      body: { Invoices: [body] },
    });
  },
  async update_item(input, context) {
    const tenantId = await resolveTenantId(input, context);
    const id = requireXeroGuid(input.item_id, "item_id");
    const body = mapXeroItem(input);
    assertXeroUpdate(body);
    body.ItemID = id;
    return xeroRequest(context, {
      tenantId,
      path: `/Items/${id}`,
      method: "POST",
      idempotencyKey: optionalString(input.idempotency_key),
      body: { Items: [body] },
    });
  },
  async update_linked_transaction(input, context) {
    const tenantId = await resolveTenantId(input, context);
    const id = requireXeroGuid(input.linked_transaction_id, "linked_transaction_id");
    const body = mapXeroLinkedTransaction(input);
    assertXeroUpdate(body);
    body.LinkedTransactionID = id;
    return xeroRequest(context, {
      tenantId,
      path: `/LinkedTransactions/${id}`,
      method: "POST",
      idempotencyKey: optionalString(input.idempotency_key),
      body: { LinkedTransactions: [body] },
    });
  },
  async update_manual_journal(input, context) {
    const tenantId = await resolveTenantId(input, context);
    const id = requireXeroGuid(input.manual_journal_id, "manual_journal_id");
    const body = mapXeroManualJournal(input);
    assertXeroUpdate(body);
    validateXeroJournal(input);
    const current = await readXeroAccountingRecord(context, tenantId, "ManualJournals", id);
    assertXeroStatus(current, ["DRAFT"], "update_manual_journal");
    body.ManualJournalID = id;
    return xeroRequest(context, {
      tenantId,
      path: `/ManualJournals/${id}`,
      method: "POST",
      idempotencyKey: optionalString(input.idempotency_key),
      body: { ManualJournals: [body] },
    });
  },
  async update_purchase_order(input, context) {
    const tenantId = await resolveTenantId(input, context);
    const id = requireXeroGuid(input.purchase_order_id, "purchase_order_id");
    const body = mapXeroPurchaseOrder(input);
    assertXeroUpdate(body);
    validateXeroLines(input);
    const current = await readXeroAccountingRecord(context, tenantId, "PurchaseOrders", id);
    assertXeroStatus(current, ["DRAFT"], "update_purchase_order");
    body.PurchaseOrderID = id;
    return xeroRequest(context, {
      tenantId,
      path: `/PurchaseOrders/${id}`,
      method: "POST",
      idempotencyKey: optionalString(input.idempotency_key),
      body: { PurchaseOrders: [body] },
    });
  },
  async update_quote(input, context) {
    const tenantId = await resolveTenantId(input, context);
    const id = requireXeroGuid(input.quote_id, "quote_id");
    const body = mapXeroQuote(input);
    assertXeroUpdate(body);
    validateXeroLines(input);
    const current = await readXeroAccountingRecord(context, tenantId, "Quotes", id);
    assertXeroStatus(current, ["DRAFT"], "update_quote");
    body.QuoteID = id;
    return xeroRequest(context, {
      tenantId,
      path: `/Quotes/${id}`,
      method: "POST",
      idempotencyKey: optionalString(input.idempotency_key),
      body: { Quotes: [body] },
    });
  },
  async archive_account(input, context) {
    const tenantId = await resolveTenantId(input, context);
    const id = requireXeroGuid(input.account_id, "account_id");
    return xeroRequest(context, {
      tenantId,
      path: `/Accounts/${id}`,
      method: "POST",
      idempotencyKey: optionalString(input.idempotency_key),
      body: { Accounts: [{ AccountID: id, Status: "ARCHIVED" }] },
    });
  },
  async create_bank_transfer(input, context) {
    const tenantId = await resolveTenantId(input, context);
    const from = requireXeroGuid(input.from_bank_account_id, "from_bank_account_id"),
      to = requireXeroGuid(input.to_bank_account_id, "to_bank_account_id");
    if (from.toLowerCase() === to.toLowerCase()) throw providerInputError("Bank transfer accounts must differ.");
    if (!((optionalNumber(input.amount) ?? 0) > 0)) throw providerInputError("amount must be positive.");
    return xeroRequest(context, {
      tenantId,
      path: "/BankTransfers",
      method: "PUT",
      idempotencyKey: optionalString(input.idempotency_key),
      body: {
        BankTransfers: [
          {
            FromBankAccount: { AccountID: from },
            ToBankAccount: { AccountID: to },
            Amount: input.amount,
            Date: input.date,
            Reference: input.reference,
            CurrencyRate: input.currency_rate,
          },
        ],
      },
    });
  },
  async create_contact_history_note(input, context) {
    const tenantId = await resolveTenantId(input, context);
    const id = requireXeroGuid(input.contact_id, "contact_id");
    return xeroRequest(context, {
      tenantId,
      path: `/Contacts/${id}/History`,
      method: "PUT",
      idempotencyKey: optionalString(input.idempotency_key),
      body: { HistoryRecords: [{ Details: requiredInputString(input.details, "details") }] },
    });
  },
  async create_invoice_history_note(input, context) {
    const tenantId = await resolveTenantId(input, context);
    const id = requireXeroGuid(input.invoice_id, "invoice_id");
    return xeroRequest(context, {
      tenantId,
      path: `/Invoices/${id}/History`,
      method: "PUT",
      idempotencyKey: optionalString(input.idempotency_key),
      body: { HistoryRecords: [{ Details: requiredInputString(input.details, "details") }] },
    });
  },
  async create_currency(input, context) {
    const tenantId = await resolveTenantId(input, context);
    return xeroRequest(context, {
      tenantId,
      path: "/Currencies",
      method: "PUT",
      idempotencyKey: optionalString(input.idempotency_key),
      body: { Code: input.code, Description: input.description },
    });
  },
  async create_linked_transaction(input, context) {
    const tenantId = await resolveTenantId(input, context);
    return xeroRequest(context, {
      tenantId,
      path: "/LinkedTransactions",
      method: "PUT",
      idempotencyKey: optionalString(input.idempotency_key),
      body: mapXeroLinkedTransaction(input),
    });
  },
  async create_payment(input, context) {
    const tenantId = await resolveTenantId(input, context);
    const invoiceId = requireXeroGuid(input.invoice_id, "invoice_id"),
      accountId = requireXeroGuid(input.account_id, "account_id");
    const amount = optionalNumber(input.amount);
    if (amount === undefined || !Number.isFinite(amount) || amount <= 0)
      throw providerInputError("amount must be positive.");
    const invoice = await readXeroAccountingRecord(context, tenantId, "Invoices", invoiceId);
    assertXeroStatus(invoice, ["AUTHORISED"], "create_payment");
    const due = optionalNumber(invoice.AmountDue);
    if (due === undefined || due <= 0 || amount > due)
      throw providerInputError("Payment amount must not exceed the invoice's positive AmountDue.");
    return xeroRequest(context, {
      tenantId,
      path: "/Payments",
      method: "PUT",
      idempotencyKey: optionalString(input.idempotency_key),
      body: {
        Payments: [
          {
            Invoice: { InvoiceID: invoiceId },
            Account: { AccountID: accountId },
            Amount: amount,
            BankAmount: input.bank_amount,
            CurrencyRate: input.currency_rate,
            Date: input.date,
            Reference: input.reference,
          },
        ],
      },
    });
  },
  async create_tracking_category(input, context) {
    const tenantId = await resolveTenantId(input, context);
    return xeroRequest(context, {
      tenantId,
      path: "/TrackingCategories",
      method: "PUT",
      idempotencyKey: optionalString(input.idempotency_key),
      body: { Name: requiredInputString(input.name, "name"), Status: "ACTIVE" },
    });
  },
  async update_tracking_category(input, context) {
    const tenantId = await resolveTenantId(input, context);
    const id = requireXeroGuid(input.tracking_category_id, "tracking_category_id");
    const body = compactObject({ Name: input.name, Status: input.status });
    assertXeroUpdate(body);
    return xeroRequest(context, {
      tenantId,
      path: `/TrackingCategories/${id}`,
      method: "POST",
      idempotencyKey: optionalString(input.idempotency_key),
      body,
    });
  },
  async create_tracking_options(input, context) {
    return writeXeroTrackingOptions(input, context, false);
  },
  async update_tracking_options(input, context) {
    return writeXeroTrackingOptions(input, context, true);
  },
  async delete_draft_invoice(input, context) {
    const tenantId = await resolveTenantId(input, context);
    const id = requireXeroGuid(input.invoice_id, "invoice_id");
    const current = await readXeroAccountingRecord(context, tenantId, "Invoices", id);
    assertXeroStatus(current, ["DRAFT", "SUBMITTED"], "delete_draft_invoice");
    return xeroRequest(context, {
      tenantId,
      path: `/Invoices/${id}`,
      method: "POST",
      idempotencyKey: optionalString(input.idempotency_key),
      body: { Invoices: [{ InvoiceID: id, Status: "DELETED" }] },
    });
  },
  async void_manual_journal(input, context) {
    const tenantId = await resolveTenantId(input, context);
    const id = requireXeroGuid(input.manual_journal_id, "manual_journal_id");
    const current = await readXeroAccountingRecord(context, tenantId, "ManualJournals", id);
    assertXeroStatus(current, ["POSTED"], "void_manual_journal");
    const narration = optionalString(current.Narration);
    if (!narration) throw providerResponseError("Xero returned a journal without Narration.");
    return xeroRequest(context, {
      tenantId,
      path: `/ManualJournals/${id}`,
      method: "POST",
      idempotencyKey: optionalString(input.idempotency_key),
      body: { ManualJournals: [{ ManualJournalID: id, Narration: narration, Status: "VOIDED" }] },
    });
  },
  async delete_payment(input, context) {
    const tenantId = await resolveTenantId(input, context);
    const id = requireXeroGuid(input.payment_id, "payment_id");
    const current = await readXeroAccountingRecord(context, tenantId, "Payments", id);
    assertXeroStatus(current, ["AUTHORISED"], "delete_payment");
    return xeroRequest(context, {
      tenantId,
      path: `/Payments/${id}`,
      method: "POST",
      idempotencyKey: optionalString(input.idempotency_key),
      body: { Status: "DELETED" },
    });
  },
  async delete_linked_transaction(input, context) {
    const tenantId = await resolveTenantId(input, context);
    const id = requireXeroGuid(input.linked_transaction_id, "linked_transaction_id");
    await xeroRequest(context, { tenantId, path: `/LinkedTransactions/${id}`, method: "DELETE" });
    return { deleted: true, linked_transaction_id: id };
  },
  async batch_create_contacts(input, context) {
    const tenantId = await resolveTenantId(input, context);
    const records = objectArray(input.contacts, "contacts", providerInputError);
    if (!records.length || records.length > 50) throw providerInputError("Batch size must be 1 to 50.");
    const items = records.map((record) => mapXeroContact(record));
    const payload = await xeroRequest(context, {
      tenantId,
      path: "/Contacts",
      method: "POST",
      idempotencyKey: optionalString(input.idempotency_key),
      query: { summarizeErrors: "false" },
      body: { Contacts: items },
    });
    return xeroBatchResult(payload, "Contacts", items.length);
  },
  async batch_create_invoices(input, context) {
    const tenantId = await resolveTenantId(input, context);
    const records = objectArray(input.invoices, "invoices", providerInputError);
    if (!records.length || records.length > 50) throw providerInputError("Batch size must be 1 to 50.");
    for (const record of records) validateXeroLines(record, true);
    const items = records.map((record) => mapXeroInvoice(record));
    for (const item of items) item.Status = "DRAFT";
    const payload = await xeroRequest(context, {
      tenantId,
      path: "/Invoices",
      method: "POST",
      idempotencyKey: optionalString(input.idempotency_key),
      query: { summarizeErrors: "false" },
      body: { Invoices: items },
    });
    return xeroBatchResult(payload, "Invoices", items.length);
  },
};
