import type { ActionDefinition } from "../../core/types.ts";

import { s } from "../../core/json-schema.ts";
import { defineProviderAction } from "../../core/provider-definition.ts";

export const xeroAccountingReadActions: ActionDefinition[] = [
  {
    name: "list_aged_payables_by_contact",
    description: "List aged payables by contact. Preserves all report headings, comparison columns and nested rows.",
    requiredScopes: ["accounting.reports.aged.read"],
    inputSchema: s.object(
      {
        tenant_id: s.uuid("The connected organisation ID."),
        contact_id: s.uuid("contactId query value."),
        date: s.date("date query value."),
        from_date: s.date("fromDate query value."),
        to_date: s.date("toDate query value."),
      },
      { required: ["contact_id"] },
    ),
    outputSchema: s.looseObject(
      "The Xero response, including provider validation details and pagination when returned.",
    ),
  },
  {
    name: "list_aged_receivables_by_contact",
    description: "List aged receivables by contact. Preserves all report headings, comparison columns and nested rows.",
    requiredScopes: ["accounting.reports.aged.read"],
    inputSchema: s.object(
      {
        tenant_id: s.uuid("The connected organisation ID."),
        contact_id: s.uuid("contactId query value."),
        date: s.date("date query value."),
        from_date: s.date("fromDate query value."),
        to_date: s.date("toDate query value."),
      },
      { required: ["contact_id"] },
    ),
    outputSchema: s.looseObject(
      "The Xero response, including provider validation details and pagination when returned.",
    ),
  },
  {
    name: "list_bank_summary",
    description: "List bank summary. Preserves all report headings, comparison columns and nested rows.",
    requiredScopes: ["accounting.reports.banksummary.read"],
    inputSchema: s.object(
      {
        tenant_id: s.uuid("The connected organisation ID."),
        from_date: s.date("fromDate query value."),
        to_date: s.date("toDate query value."),
      },
      { required: [] },
    ),
    outputSchema: s.looseObject(
      "The Xero response, including provider validation details and pagination when returned.",
    ),
  },
  {
    name: "list_bank_transfers",
    description: "List bank transfers. Returns the upstream resource envelope with all available fields.",
    requiredScopes: ["accounting.banktransactions.read"],
    inputSchema: s.object(
      {
        tenant_id: s.uuid("The connected organisation ID."),
        where: s.string("where query value.", {}),
        order: s.string("order query value.", {}),
        include_deleted: s.boolean({}),
      },
      { required: [] },
    ),
    outputSchema: s.looseObject(
      "The Xero response, including provider validation details and pagination when returned.",
    ),
  },
  {
    name: "list_branding_themes",
    description: "List branding themes. Returns the upstream resource envelope with all available fields.",
    requiredScopes: ["accounting.settings.read"],
    inputSchema: s.object({ tenant_id: s.uuid("The connected organisation ID.") }, { required: [] }),
    outputSchema: s.looseObject(
      "The Xero response, including provider validation details and pagination when returned.",
    ),
  },
  {
    name: "list_budget_summary",
    description: "List budget summary. Preserves all report headings, comparison columns and nested rows.",
    requiredScopes: ["accounting.reports.budgetsummary.read"],
    inputSchema: s.object(
      {
        tenant_id: s.uuid("The connected organisation ID."),
        date: s.date("date query value."),
        periods: s.integer({}),
        timeframe: s.integer({}),
      },
      { required: [] },
    ),
    outputSchema: s.looseObject(
      "The Xero response, including provider validation details and pagination when returned.",
    ),
  },
  {
    name: "list_budgets",
    description: "List budgets. Returns the upstream resource envelope with all available fields.",
    requiredScopes: ["accounting.budgets.read"],
    inputSchema: s.object(
      {
        tenant_id: s.uuid("The connected organisation ID."),
        ids: s.string("IDs query value.", {}),
        date_to: s.date("DateTo query value."),
        date_from: s.date("DateFrom query value."),
      },
      { required: [] },
    ),
    outputSchema: s.looseObject(
      "The Xero response, including provider validation details and pagination when returned.",
    ),
  },
  {
    name: "list_contact_groups",
    description: "List contact groups. Returns the upstream resource envelope with all available fields.",
    requiredScopes: ["accounting.contacts.read"],
    inputSchema: s.object(
      {
        tenant_id: s.uuid("The connected organisation ID."),
        where: s.string("where query value.", {}),
        order: s.string("order query value.", {}),
      },
      { required: [] },
    ),
    outputSchema: s.looseObject(
      "The Xero response, including provider validation details and pagination when returned.",
    ),
  },
  {
    name: "list_credit_notes",
    description: "List credit notes. Returns the upstream resource envelope with all available fields.",
    requiredScopes: ["accounting.invoices.read"],
    inputSchema: s.object(
      {
        tenant_id: s.uuid("The connected organisation ID."),
        where: s.string("where query value.", {}),
        order: s.string("order query value.", {}),
        page: s.integer({ minimum: 1, default: 1 }),
        unitdp: s.integer({}),
        page_size: s.integer({ minimum: 1, maximum: 1000 }),
      },
      { required: [] },
    ),
    outputSchema: s.looseObject(
      "The Xero response, including provider validation details and pagination when returned.",
    ),
  },
  {
    name: "list_currencies",
    description: "List currencies. Returns the upstream resource envelope with all available fields.",
    requiredScopes: ["accounting.settings.read"],
    inputSchema: s.object(
      {
        tenant_id: s.uuid("The connected organisation ID."),
        where: s.string("where query value.", {}),
        order: s.string("order query value.", {}),
      },
      { required: [] },
    ),
    outputSchema: s.looseObject(
      "The Xero response, including provider validation details and pagination when returned.",
    ),
  },
  {
    name: "list_executive_summary",
    description: "List executive summary. Preserves all report headings, comparison columns and nested rows.",
    requiredScopes: ["accounting.reports.executivesummary.read"],
    inputSchema: s.object(
      { tenant_id: s.uuid("The connected organisation ID."), date: s.date("date query value.") },
      { required: [] },
    ),
    outputSchema: s.looseObject(
      "The Xero response, including provider validation details and pagination when returned.",
    ),
  },
  {
    name: "list_linked_transactions",
    description: "List linked transactions. Returns the upstream resource envelope with all available fields.",
    requiredScopes: ["accounting.invoices.read"],
    inputSchema: s.object(
      {
        tenant_id: s.uuid("The connected organisation ID."),
        page: s.integer({ minimum: 1, default: 1 }),
        linked_transaction_id: s.uuid("LinkedTransactionID query value."),
        source_transaction_id: s.uuid("SourceTransactionID query value."),
        contact_id: s.uuid("ContactID query value."),
        status: s.string("Status query value.", {}),
        target_transaction_id: s.uuid("TargetTransactionID query value."),
      },
      { required: [] },
    ),
    outputSchema: s.looseObject(
      "The Xero response, including provider validation details and pagination when returned.",
    ),
  },
  {
    name: "list_manual_journals",
    description: "List manual journals. Returns the upstream resource envelope with all available fields.",
    requiredScopes: ["accounting.manualjournals.read"],
    inputSchema: s.object(
      {
        tenant_id: s.uuid("The connected organisation ID."),
        where: s.string("where query value.", {}),
        order: s.string("order query value.", {}),
        page: s.integer({ minimum: 1, default: 1 }),
        page_size: s.integer({ minimum: 1, maximum: 1000 }),
      },
      { required: [] },
    ),
    outputSchema: s.looseObject(
      "The Xero response, including provider validation details and pagination when returned.",
    ),
  },
  {
    name: "list_overpayments",
    description: "List overpayments. Returns the upstream resource envelope with all available fields.",
    requiredScopes: ["accounting.payments.read"],
    inputSchema: s.object(
      {
        tenant_id: s.uuid("The connected organisation ID."),
        where: s.string("where query value.", {}),
        order: s.string("order query value.", {}),
        page: s.integer({ minimum: 1, default: 1 }),
        unitdp: s.integer({}),
        page_size: s.integer({ minimum: 1, maximum: 1000 }),
        references: s.array(s.string("References query value. item", {})),
      },
      { required: [] },
    ),
    outputSchema: s.looseObject(
      "The Xero response, including provider validation details and pagination when returned.",
    ),
  },
  {
    name: "list_prepayments",
    description: "List prepayments. Returns the upstream resource envelope with all available fields.",
    requiredScopes: ["accounting.payments.read"],
    inputSchema: s.object(
      {
        tenant_id: s.uuid("The connected organisation ID."),
        where: s.string("where query value.", {}),
        order: s.string("order query value.", {}),
        page: s.integer({ minimum: 1, default: 1 }),
        unitdp: s.integer({}),
        page_size: s.integer({ minimum: 1, maximum: 1000 }),
        invoice_numbers: s.array(s.string("InvoiceNumbers query value. item", {})),
        references: s.array(s.string("References query value. item", {})),
      },
      { required: [] },
    ),
    outputSchema: s.looseObject(
      "The Xero response, including provider validation details and pagination when returned.",
    ),
  },
  {
    name: "list_profit_and_loss_with_tracking",
    description:
      "List profit and loss with tracking. Preserves all report headings, comparison columns and nested rows.",
    requiredScopes: ["accounting.reports.profitandloss.read"],
    inputSchema: s.object(
      {
        tenant_id: s.uuid("The connected organisation ID."),
        from_date: s.date("fromDate query value."),
        to_date: s.date("toDate query value."),
        periods: s.integer({}),
        timeframe: s.stringEnum(["MONTH", "QUARTER", "YEAR"]),
        tracking_category_id: s.string("trackingCategoryID query value.", {}),
        tracking_category_id_2: s.string("trackingCategoryID2 query value.", {}),
        tracking_option_id: s.string("trackingOptionID query value.", {}),
        tracking_option_id_2: s.string("trackingOptionID2 query value.", {}),
        standard_layout: s.boolean({}),
        payments_only: s.boolean({}),
      },
      { required: [] },
    ),
    outputSchema: s.looseObject(
      "The Xero response, including provider validation details and pagination when returned.",
    ),
  },
  {
    name: "list_repeating_invoices",
    description: "List repeating invoices. Returns the upstream resource envelope with all available fields.",
    requiredScopes: ["accounting.invoices.read"],
    inputSchema: s.object(
      {
        tenant_id: s.uuid("The connected organisation ID."),
        where: s.string("where query value.", {}),
        order: s.string("order query value.", {}),
      },
      { required: [] },
    ),
    outputSchema: s.looseObject(
      "The Xero response, including provider validation details and pagination when returned.",
    ),
  },
  {
    name: "list_trial_balance",
    description: "List trial balance. Preserves all report headings, comparison columns and nested rows.",
    requiredScopes: ["accounting.reports.trialbalance.read"],
    inputSchema: s.object(
      {
        tenant_id: s.uuid("The connected organisation ID."),
        date: s.date("date query value."),
        payments_only: s.boolean({}),
      },
      { required: [] },
    ),
    outputSchema: s.looseObject(
      "The Xero response, including provider validation details and pagination when returned.",
    ),
  },
  {
    name: "list_users",
    description: "List users. Returns the upstream resource envelope with all available fields.",
    requiredScopes: ["accounting.settings.read"],
    inputSchema: s.object(
      {
        tenant_id: s.uuid("The connected organisation ID."),
        where: s.string("where query value.", {}),
        order: s.string("order query value.", {}),
      },
      { required: [] },
    ),
    outputSchema: s.looseObject(
      "The Xero response, including provider validation details and pagination when returned.",
    ),
  },
  {
    name: "get_bank_transaction_history",
    description: "Get bank transaction history. An empty history does not prove the parent exists.",
    requiredScopes: ["accounting.banktransactions.read"],
    inputSchema: s.object(
      {
        tenant_id: s.uuid("The connected organisation ID."),
        bank_transaction_id: s.uuid("BankTransactionID identifier."),
      },
      { required: ["bank_transaction_id"] },
    ),
    outputSchema: s.looseObject(
      "The Xero response, including provider validation details and pagination when returned.",
    ),
  },
  {
    name: "get_bank_transfer",
    description: "Get bank transfer. Returns the upstream resource envelope with all available fields.",
    requiredScopes: ["accounting.banktransactions.read"],
    inputSchema: s.object(
      { tenant_id: s.uuid("The connected organisation ID."), bank_transfer_id: s.uuid("BankTransferID identifier.") },
      { required: ["bank_transfer_id"] },
    ),
    outputSchema: s.looseObject(
      "The Xero response, including provider validation details and pagination when returned.",
    ),
  },
  {
    name: "get_budget",
    description: "Get budget. Returns the upstream resource envelope with all available fields.",
    requiredScopes: ["accounting.budgets.read"],
    inputSchema: s.object(
      {
        tenant_id: s.uuid("The connected organisation ID."),
        budget_id: s.uuid("BudgetID identifier."),
        date_to: s.date("DateTo query value."),
        date_from: s.date("DateFrom query value."),
      },
      { required: ["budget_id"] },
    ),
    outputSchema: s.looseObject(
      "The Xero response, including provider validation details and pagination when returned.",
    ),
  },
  {
    name: "get_contact_history",
    description: "Get contact history. An empty history does not prove the parent exists.",
    requiredScopes: ["accounting.contacts.read"],
    inputSchema: s.object(
      { tenant_id: s.uuid("The connected organisation ID."), contact_id: s.uuid("ContactID identifier.") },
      { required: ["contact_id"] },
    ),
    outputSchema: s.looseObject(
      "The Xero response, including provider validation details and pagination when returned.",
    ),
  },
  {
    name: "get_credit_note",
    description: "Get credit note. Returns the upstream resource envelope with all available fields.",
    requiredScopes: ["accounting.invoices.read"],
    inputSchema: s.object(
      {
        tenant_id: s.uuid("The connected organisation ID."),
        credit_note_id: s.uuid("CreditNoteID identifier."),
        unitdp: s.integer({}),
      },
      { required: ["credit_note_id"] },
    ),
    outputSchema: s.looseObject(
      "The Xero response, including provider validation details and pagination when returned.",
    ),
  },
  {
    name: "get_invoice_history",
    description: "Get invoice history. An empty history does not prove the parent exists.",
    requiredScopes: ["accounting.invoices.read"],
    inputSchema: s.object(
      { tenant_id: s.uuid("The connected organisation ID."), invoice_id: s.uuid("InvoiceID identifier.") },
      { required: ["invoice_id"] },
    ),
    outputSchema: s.looseObject(
      "The Xero response, including provider validation details and pagination when returned.",
    ),
  },
  {
    name: "get_manual_journal",
    description: "Get manual journal. Returns the upstream resource envelope with all available fields.",
    requiredScopes: ["accounting.manualjournals.read"],
    inputSchema: s.object(
      { tenant_id: s.uuid("The connected organisation ID."), manual_journal_id: s.uuid("ManualJournalID identifier.") },
      { required: ["manual_journal_id"] },
    ),
    outputSchema: s.looseObject(
      "The Xero response, including provider validation details and pagination when returned.",
    ),
  },
  {
    name: "get_overpayment",
    description: "Get overpayment. Returns the upstream resource envelope with all available fields.",
    requiredScopes: ["accounting.payments.read"],
    inputSchema: s.object(
      { tenant_id: s.uuid("The connected organisation ID."), overpayment_id: s.uuid("OverpaymentID identifier.") },
      { required: ["overpayment_id"] },
    ),
    outputSchema: s.looseObject(
      "The Xero response, including provider validation details and pagination when returned.",
    ),
  },
  {
    name: "get_prepayment",
    description: "Get prepayment. Returns the upstream resource envelope with all available fields.",
    requiredScopes: ["accounting.payments.read"],
    inputSchema: s.object(
      { tenant_id: s.uuid("The connected organisation ID."), prepayment_id: s.uuid("PrepaymentID identifier.") },
      { required: ["prepayment_id"] },
    ),
    outputSchema: s.looseObject(
      "The Xero response, including provider validation details and pagination when returned.",
    ),
  },
  {
    name: "get_repeating_invoice",
    description: "Get repeating invoice. Returns the upstream resource envelope with all available fields.",
    requiredScopes: ["accounting.invoices.read"],
    inputSchema: s.object(
      {
        tenant_id: s.uuid("The connected organisation ID."),
        repeating_invoice_id: s.uuid("RepeatingInvoiceID identifier."),
      },
      { required: ["repeating_invoice_id"] },
    ),
    outputSchema: s.looseObject(
      "The Xero response, including provider validation details and pagination when returned.",
    ),
  },
  {
    name: "get_tax_rate",
    description: "Get tax rate. Returns the upstream resource envelope with all available fields.",
    requiredScopes: ["accounting.settings.read"],
    inputSchema: s.object(
      { tenant_id: s.uuid("The connected organisation ID."), tax_type: s.string("TaxType identifier.", {}) },
      { required: ["tax_type"] },
    ),
    outputSchema: s.looseObject(
      "The Xero response, including provider validation details and pagination when returned.",
    ),
  },
  {
    name: "get_user",
    description: "Get user. Returns the upstream resource envelope with all available fields.",
    requiredScopes: ["accounting.settings.read"],
    inputSchema: s.object(
      { tenant_id: s.uuid("The connected organisation ID."), user_id: s.uuid("UserID identifier.") },
      { required: ["user_id"] },
    ),
    outputSchema: s.looseObject(
      "The Xero response, including provider validation details and pagination when returned.",
    ),
  },
  {
    name: "get_history",
    description:
      "Read the history of an Accounting object. An empty history does not prove the parent exists. The connection needs the read scope for the selected entity.",
    requiredScopes: [
      "accounting.invoices.read",
      "accounting.payments.read",
      "accounting.settings.read",
      "accounting.manualjournals.read",
      "accounting.banktransactions.read",
    ],
    inputSchema: s.object(
      {
        tenant_id: s.uuid("The connected organisation ID."),
        entity_type: s.stringEnum([
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
        ]),
        entity_id: s.uuid("The resource ID."),
      },
      { required: ["entity_type", "entity_id"] },
    ),
    outputSchema: s.looseObject(
      "The Xero response, including provider validation details and pagination when returned.",
    ),
  },
].map((action) => defineProviderAction("xero", action));
