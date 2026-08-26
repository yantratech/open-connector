import type { ActionDefinition } from "../../core/types.ts";

import { s } from "../../core/json-schema.ts";
import { defineProviderAction } from "../../core/provider-definition.ts";
import { revolutReadScope, revolutWriteScope } from "./scopes.ts";

const service = "revolut";
const rawObject = s.looseObject("The raw Revolut Business API object.");
const uuid = (description: string) => s.uuid(description);

const transactionTypes = [
  "atm",
  "card_payment",
  "card_refund",
  "card_chargeback",
  "card_credit",
  "charge",
  "charge_refund",
  "exchange",
  "transfer",
  "loan",
  "fee",
  "refund",
  "topup",
  "topup_return",
  "tax",
  "tax_refund",
] as const;

export const revolutActions: ActionDefinition[] = [
  defineProviderAction(service, {
    name: "list_accounts",
    description:
      "List Revolut Business accounts and their current balances. Revolut exposes one balance figure rather than an available/pending split.",
    requiredScopes: [revolutReadScope],
    inputSchema: s.object("No input is required to list Revolut Business accounts.", {}),
    outputSchema: s.object("The Revolut Business accounts visible to this connection.", {
      count: s.nonNegativeInteger("The number of accounts returned."),
      balance_note: s.string("A reminder about Revolut's balance semantics."),
      accounts: s.array("The accounts returned by Revolut.", rawObject),
    }),
  }),
  defineProviderAction(service, {
    name: "get_account",
    description: "Get one Revolut Business account, optionally including its bank-detail routes.",
    requiredScopes: [revolutReadScope],
    inputSchema: s.object(
      "The Revolut Business account lookup.",
      {
        account_id: uuid("The Revolut account UUID."),
        include_bank_details: s.boolean("Whether to include the account's bank-detail routes."),
      },
      { optional: ["include_bank_details"] },
    ),
    outputSchema: s.looseRequiredObject(
      "The Revolut account, with bank_details when requested.",
      {
        bank_details: s.array("Bank-detail routes for this account.", rawObject),
      },
      { optional: ["bank_details"] },
    ),
  }),
  defineProviderAction(service, {
    name: "list_transactions",
    description:
      "List Revolut Business transactions newest first. Declined, failed, and reverted rows are not settled money movement.",
    requiredScopes: [revolutReadScope],
    inputSchema: s.object(
      "Filters and pagination for Revolut transactions.",
      {
        from: s.dateTime("Inclusive lower bound on created_at."),
        to: s.dateTime("Upper bound on created_at and timestamp cursor for the next page."),
        account: uuid("Filter to one Revolut account UUID."),
        count: s.integer("Page size.", { minimum: 1, maximum: 1000, default: 50 }),
        type: s.stringEnum("Filter by Revolut transaction type.", transactionTypes),
        detail: s.stringEnum("Return compact or full transaction records.", ["compact", "full"]),
      },
      { optional: ["from", "to", "account", "count", "type", "detail"] },
    ),
    outputSchema: s.object("A page of Revolut transactions.", {
      count: s.nonNegativeInteger("The number of transactions returned."),
      more_available: s.boolean("Whether another page may be available."),
      next_page_to: s.nullableString("Timestamp cursor for the next page."),
      states: s.record("Counts keyed by transaction state.", s.nonNegativeInteger("State count.")),
      transactions: s.array("The transactions returned by Revolut.", rawObject),
    }),
  }),
  defineProviderAction(service, {
    name: "get_transaction",
    description: "Get one Revolut Business transaction, including its legs and state.",
    requiredScopes: [revolutReadScope],
    inputSchema: s.object("The Revolut transaction lookup.", {
      transaction_id: s.nonEmptyString("The Revolut transaction ID."),
    }),
    outputSchema: rawObject,
  }),
  defineProviderAction(service, {
    name: "list_counterparties",
    description: "List saved Revolut counterparties. sort_code requires account_no, and bic requires iban.",
    requiredScopes: [revolutReadScope],
    inputSchema: s.object(
      "Filters and pagination for Revolut counterparties.",
      {
        name: s.string("Partial counterparty name match."),
        account_no: s.string("Exact account number match."),
        sort_code: s.string("Sort code; only valid with account_no."),
        iban: s.string("Exact IBAN match."),
        bic: s.string("BIC; only valid with iban."),
        created_before: s.dateTime("Return counterparties created before this timestamp."),
        limit: s.integer("Page size.", { minimum: 1, maximum: 1000, default: 100 }),
      },
      { optional: ["name", "account_no", "sort_code", "iban", "bic", "created_before", "limit"] },
    ),
    outputSchema: s.object("A page of Revolut counterparties.", {
      count: s.nonNegativeInteger("The number of counterparties returned."),
      more_available: s.boolean("Whether another page may be available."),
      next_page_created_before: s.nullableString("Timestamp cursor for the next page."),
      counterparties: s.array("The counterparties returned by Revolut.", rawObject),
    }),
  }),
  defineProviderAction(service, {
    name: "get_counterparty",
    description: "Get one Revolut counterparty, including its receiving accounts and cards.",
    requiredScopes: [revolutReadScope],
    inputSchema: s.object("The Revolut counterparty lookup.", {
      counterparty_id: uuid("The Revolut counterparty UUID."),
    }),
    outputSchema: rawObject,
  }),
  defineProviderAction(service, {
    name: "create_payment_draft",
    description:
      "Create one inert payment draft. This action cannot send money: a human must approve the draft in Revolut Business. It validates the payee and paying account and fails closed if duplicate drafts cannot be checked.",
    requiredScopes: [revolutReadScope, revolutWriteScope],
    inputSchema: s.object(
      "The payment draft to prepare for human review.",
      {
        title: s.string("Human-readable purpose; the operator attribution is prepended."),
        schedule_for: s.date("Optional date on which to schedule the payment."),
        account_id: uuid("The Revolut account UUID to pay from."),
        counterparty_id: uuid("The existing Revolut counterparty UUID to pay."),
        receiver_account_id: uuid("A specific receiving account or card UUID when the counterparty has several."),
        amount: s.number("The payment amount.", { exclusiveMinimum: 0 }),
        currency: s.string("The three-letter ISO 4217 currency code.", { pattern: "^[A-Z]{3}$" }),
        reference: s.nonEmptyString("The payment reference, such as a supplier invoice number."),
        transfer_reason_code: s.string("A Revolut transfer reason code when a prior attempt required one."),
      },
      { optional: ["title", "schedule_for", "receiver_account_id", "transfer_reason_code"] },
    ),
    outputSchema: s.object("The prepared payment draft.", {
      id: s.nullableString("The payment draft UUID returned by Revolut."),
      title: s.string("The operator-attributed draft title."),
      receiver: rawObject,
      reminder: s.string("A reminder that the draft still requires human approval."),
    }),
  }),
  defineProviderAction(service, {
    name: "list_payment_drafts",
    description:
      "List pending payment drafts created through the Revolut API. App-created drafts are outside this action's duplicate-check boundary.",
    requiredScopes: [revolutReadScope],
    inputSchema: s.object("No input is required to list Revolut payment drafts.", {}),
    outputSchema: rawObject,
  }),
  defineProviderAction(service, {
    name: "get_payment_draft",
    description: "Get one Revolut payment draft and its payment details.",
    requiredScopes: [revolutReadScope],
    inputSchema: s.object("The Revolut payment draft lookup.", {
      draft_id: uuid("The Revolut payment draft UUID."),
    }),
    outputSchema: rawObject,
  }),
];
