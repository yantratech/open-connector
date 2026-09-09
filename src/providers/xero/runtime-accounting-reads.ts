import type { ProviderActionHandlerSubset, ProviderRuntimeHandler, OAuthProviderContext } from "../provider-runtime.ts";

import { optionalScalarString, optionalString, optionalStringArray } from "../../core/cast.ts";
import { providerInputError } from "../provider-runtime.ts";
import { xeroCodeSegment } from "./runtime-input.ts";
import { xeroRequest, resolveTenantId, requireXeroGuid } from "./runtime-request.ts";
export const xeroAccountingReadHandlers: ProviderActionHandlerSubset<
  "xero",
  ProviderRuntimeHandler<OAuthProviderContext>
> = {
  async list_aged_payables_by_contact(input, context) {
    const tenantId = await resolveTenantId(input, context);
    return xeroRequest(context, {
      tenantId,
      path: `/Reports/AgedPayablesByContact`,
      query: {
        contactId: input.contact_id === undefined ? undefined : requireXeroGuid(input.contact_id, "contact_id"),
        date: optionalScalarString(input.date),
        fromDate: optionalScalarString(input.from_date),
        toDate: optionalScalarString(input.to_date),
      },
    });
  },
  async list_aged_receivables_by_contact(input, context) {
    const tenantId = await resolveTenantId(input, context);
    return xeroRequest(context, {
      tenantId,
      path: `/Reports/AgedReceivablesByContact`,
      query: {
        contactId: input.contact_id === undefined ? undefined : requireXeroGuid(input.contact_id, "contact_id"),
        date: optionalScalarString(input.date),
        fromDate: optionalScalarString(input.from_date),
        toDate: optionalScalarString(input.to_date),
      },
    });
  },
  async list_bank_summary(input, context) {
    const tenantId = await resolveTenantId(input, context);
    return xeroRequest(context, {
      tenantId,
      path: `/Reports/BankSummary`,
      query: { fromDate: optionalScalarString(input.from_date), toDate: optionalScalarString(input.to_date) },
    });
  },
  async list_bank_transfers(input, context) {
    const tenantId = await resolveTenantId(input, context);
    return xeroRequest(context, {
      tenantId,
      path: `/BankTransfers`,
      query: {
        where: optionalScalarString(input.where),
        order: optionalScalarString(input.order),
        includeDeleted: optionalScalarString(input.include_deleted),
      },
    });
  },
  async list_branding_themes(input, context) {
    const tenantId = await resolveTenantId(input, context);
    return xeroRequest(context, { tenantId, path: `/BrandingThemes`, query: {} });
  },
  async list_budget_summary(input, context) {
    const tenantId = await resolveTenantId(input, context);
    return xeroRequest(context, {
      tenantId,
      path: `/Reports/BudgetSummary`,
      query: {
        date: optionalScalarString(input.date),
        periods: optionalScalarString(input.periods),
        timeframe: optionalScalarString(input.timeframe),
      },
    });
  },
  async list_budgets(input, context) {
    const tenantId = await resolveTenantId(input, context);
    return xeroRequest(context, {
      tenantId,
      path: `/Budgets`,
      query: {
        IDs: optionalScalarString(input.ids),
        DateTo: optionalScalarString(input.date_to),
        DateFrom: optionalScalarString(input.date_from),
      },
    });
  },
  async list_contact_groups(input, context) {
    const tenantId = await resolveTenantId(input, context);
    return xeroRequest(context, {
      tenantId,
      path: `/ContactGroups`,
      query: { where: optionalScalarString(input.where), order: optionalScalarString(input.order) },
    });
  },
  async list_credit_notes(input, context) {
    const tenantId = await resolveTenantId(input, context);
    return xeroRequest(context, {
      tenantId,
      path: `/CreditNotes`,
      query: {
        where: optionalScalarString(input.where),
        order: optionalScalarString(input.order),
        page: optionalScalarString(input.page),
        unitdp: optionalScalarString(input.unitdp),
        pageSize: optionalScalarString(input.page_size),
      },
    });
  },
  async list_currencies(input, context) {
    const tenantId = await resolveTenantId(input, context);
    return xeroRequest(context, {
      tenantId,
      path: `/Currencies`,
      query: { where: optionalScalarString(input.where), order: optionalScalarString(input.order) },
    });
  },
  async list_executive_summary(input, context) {
    const tenantId = await resolveTenantId(input, context);
    return xeroRequest(context, {
      tenantId,
      path: `/Reports/ExecutiveSummary`,
      query: { date: optionalScalarString(input.date) },
    });
  },
  async list_linked_transactions(input, context) {
    const tenantId = await resolveTenantId(input, context);
    return xeroRequest(context, {
      tenantId,
      path: `/LinkedTransactions`,
      query: {
        page: optionalScalarString(input.page),
        LinkedTransactionID:
          input.linked_transaction_id === undefined
            ? undefined
            : requireXeroGuid(input.linked_transaction_id, "linked_transaction_id"),
        SourceTransactionID:
          input.source_transaction_id === undefined
            ? undefined
            : requireXeroGuid(input.source_transaction_id, "source_transaction_id"),
        ContactID: input.contact_id === undefined ? undefined : requireXeroGuid(input.contact_id, "contact_id"),
        Status: optionalScalarString(input.status),
        TargetTransactionID:
          input.target_transaction_id === undefined
            ? undefined
            : requireXeroGuid(input.target_transaction_id, "target_transaction_id"),
      },
    });
  },
  async list_manual_journals(input, context) {
    const tenantId = await resolveTenantId(input, context);
    return xeroRequest(context, {
      tenantId,
      path: `/ManualJournals`,
      query: {
        where: optionalScalarString(input.where),
        order: optionalScalarString(input.order),
        page: optionalScalarString(input.page),
        pageSize: optionalScalarString(input.page_size),
      },
    });
  },
  async list_overpayments(input, context) {
    const tenantId = await resolveTenantId(input, context);
    return xeroRequest(context, {
      tenantId,
      path: `/Overpayments`,
      query: {
        where: optionalScalarString(input.where),
        order: optionalScalarString(input.order),
        page: optionalScalarString(input.page),
        unitdp: optionalScalarString(input.unitdp),
        pageSize: optionalScalarString(input.page_size),
        References: optionalStringArray(input.references)?.join(","),
      },
    });
  },
  async list_prepayments(input, context) {
    const tenantId = await resolveTenantId(input, context);
    return xeroRequest(context, {
      tenantId,
      path: `/Prepayments`,
      query: {
        where: optionalScalarString(input.where),
        order: optionalScalarString(input.order),
        page: optionalScalarString(input.page),
        unitdp: optionalScalarString(input.unitdp),
        pageSize: optionalScalarString(input.page_size),
        InvoiceNumbers: optionalStringArray(input.invoice_numbers)?.join(","),
        References: optionalStringArray(input.references)?.join(","),
      },
    });
  },
  async list_profit_and_loss_with_tracking(input, context) {
    const tenantId = await resolveTenantId(input, context);
    return xeroRequest(context, {
      tenantId,
      path: `/Reports/ProfitAndLoss`,
      query: {
        fromDate: optionalScalarString(input.from_date),
        toDate: optionalScalarString(input.to_date),
        periods: optionalScalarString(input.periods),
        timeframe: optionalScalarString(input.timeframe),
        trackingCategoryID: optionalScalarString(input.tracking_category_id),
        trackingCategoryID2: optionalScalarString(input.tracking_category_id_2),
        trackingOptionID: optionalScalarString(input.tracking_option_id),
        trackingOptionID2: optionalScalarString(input.tracking_option_id_2),
        standardLayout: optionalScalarString(input.standard_layout),
        paymentsOnly: optionalScalarString(input.payments_only),
      },
    });
  },
  async list_repeating_invoices(input, context) {
    const tenantId = await resolveTenantId(input, context);
    return xeroRequest(context, {
      tenantId,
      path: `/RepeatingInvoices`,
      query: { where: optionalScalarString(input.where), order: optionalScalarString(input.order) },
    });
  },
  async list_trial_balance(input, context) {
    const tenantId = await resolveTenantId(input, context);
    return xeroRequest(context, {
      tenantId,
      path: `/Reports/TrialBalance`,
      query: { date: optionalScalarString(input.date), paymentsOnly: optionalScalarString(input.payments_only) },
    });
  },
  async list_users(input, context) {
    const tenantId = await resolveTenantId(input, context);
    return xeroRequest(context, {
      tenantId,
      path: `/Users`,
      query: { where: optionalScalarString(input.where), order: optionalScalarString(input.order) },
    });
  },
  async get_bank_transaction_history(input, context) {
    const tenantId = await resolveTenantId(input, context);
    return xeroRequest(context, {
      tenantId,
      path: `/BankTransactions/${requireXeroGuid(input.bank_transaction_id, "bank_transaction_id")}/History`,
      query: {},
    });
  },
  async get_bank_transfer(input, context) {
    const tenantId = await resolveTenantId(input, context);
    return xeroRequest(context, {
      tenantId,
      path: `/BankTransfers/${requireXeroGuid(input.bank_transfer_id, "bank_transfer_id")}`,
      query: {},
    });
  },
  async get_budget(input, context) {
    const tenantId = await resolveTenantId(input, context);
    return xeroRequest(context, {
      tenantId,
      path: `/Budgets/${requireXeroGuid(input.budget_id, "budget_id")}`,
      query: { DateTo: optionalScalarString(input.date_to), DateFrom: optionalScalarString(input.date_from) },
    });
  },
  async get_contact_history(input, context) {
    const tenantId = await resolveTenantId(input, context);
    return xeroRequest(context, {
      tenantId,
      path: `/Contacts/${requireXeroGuid(input.contact_id, "contact_id")}/History`,
      query: {},
    });
  },
  async get_credit_note(input, context) {
    const tenantId = await resolveTenantId(input, context);
    return xeroRequest(context, {
      tenantId,
      path: `/CreditNotes/${requireXeroGuid(input.credit_note_id, "credit_note_id")}`,
      query: { unitdp: optionalScalarString(input.unitdp) },
    });
  },
  async get_invoice_history(input, context) {
    const tenantId = await resolveTenantId(input, context);
    return xeroRequest(context, {
      tenantId,
      path: `/Invoices/${requireXeroGuid(input.invoice_id, "invoice_id")}/History`,
      query: {},
    });
  },
  async get_manual_journal(input, context) {
    const tenantId = await resolveTenantId(input, context);
    return xeroRequest(context, {
      tenantId,
      path: `/ManualJournals/${requireXeroGuid(input.manual_journal_id, "manual_journal_id")}`,
      query: {},
    });
  },
  async get_overpayment(input, context) {
    const tenantId = await resolveTenantId(input, context);
    return xeroRequest(context, {
      tenantId,
      path: `/Overpayments/${requireXeroGuid(input.overpayment_id, "overpayment_id")}`,
      query: {},
    });
  },
  async get_prepayment(input, context) {
    const tenantId = await resolveTenantId(input, context);
    return xeroRequest(context, {
      tenantId,
      path: `/Prepayments/${requireXeroGuid(input.prepayment_id, "prepayment_id")}`,
      query: {},
    });
  },
  async get_repeating_invoice(input, context) {
    const tenantId = await resolveTenantId(input, context);
    return xeroRequest(context, {
      tenantId,
      path: `/RepeatingInvoices/${requireXeroGuid(input.repeating_invoice_id, "repeating_invoice_id")}`,
      query: {},
    });
  },
  async get_tax_rate(input, context) {
    const tenantId = await resolveTenantId(input, context);
    return xeroRequest(context, {
      tenantId,
      path: `/TaxRates/${xeroCodeSegment(input.tax_type, "tax_type")}`,
      query: {},
    });
  },
  async get_user(input, context) {
    const tenantId = await resolveTenantId(input, context);
    return xeroRequest(context, { tenantId, path: `/Users/${requireXeroGuid(input.user_id, "user_id")}`, query: {} });
  },
  async get_history(input, context) {
    const type = optionalString(input.entity_type);
    if (
      !type ||
      ![
        "CreditNotes",
        "Payments",
        "PurchaseOrders",
        "Quotes",
        "Items",
        "ManualJournals",
        "BankTransfers",
        "Prepayments",
        "Overpayments",
        "RepeatingInvoices",
      ].includes(type)
    )
      throw providerInputError("Unsupported history entity_type.");
    const tenantId = await resolveTenantId(input, context);
    return xeroRequest(context, {
      tenantId,
      path: `/${type}/${requireXeroGuid(input.entity_id, "entity_id")}/History`,
    });
  },
};
