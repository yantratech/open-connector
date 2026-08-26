import type { CredentialValidators, ProviderExecutors } from "../../core/types.ts";
import type { OAuthProviderContext, ProviderActionHandlers, ProviderRuntimeHandler } from "../provider-runtime.ts";

import { optionalInteger, optionalNumber, optionalRecord, optionalString, requiredString } from "../../core/cast.ts";
import { arrayPayload, definedBody, objectPayload, requestJson } from "../http-json-runtime.ts";
import { defineOAuthProviderExecutors, ProviderRequestError } from "../provider-runtime.ts";

const service = "revolut";
const defaultTransactionCount = 50;
const defaultCounterpartyLimit = 100;
const maxDraftTitleLength = 255;
const allowedApiBaseUrls = new Set(["https://sandbox-b2b.revolut.com/api/1.0", "https://b2b.revolut.com/api/1.0"]);

export const revolutActionHandlers: ProviderActionHandlers<"revolut", RevolutHandler> = {
  async list_accounts(_input, context) {
    const accounts = arrayPayload(await revolutRequest(context, "/accounts"), "Revolut accounts");
    return {
      count: accounts.length,
      balance_note:
        "balance is the single current figure Revolut reports; the Business API does not expose an available/pending split.",
      accounts,
    };
  },
  async get_account(input, context) {
    const accountId = requiredString(input.account_id, "account_id");
    const account = objectPayload(
      await revolutRequest(context, `/accounts/${encodeURIComponent(accountId)}`),
      "Revolut account",
    );
    if (input.include_bank_details === true) {
      return {
        ...account,
        bank_details: arrayPayload(
          await revolutRequest(context, `/accounts/${encodeURIComponent(accountId)}/bank-details`),
          "Revolut account bank details",
        ),
      };
    }
    return account;
  },
  async list_transactions(input, context) {
    const count = optionalInteger(input.count) ?? defaultTransactionCount;
    const transactions = arrayPayload(
      await revolutRequest(context, "/transactions", {
        query: definedQuery({
          from: optionalString(input.from),
          to: optionalString(input.to),
          account: optionalString(input.account),
          count,
          type: optionalString(input.type),
        }),
      }),
      "Revolut transactions",
    );
    const nextPageTo =
      transactions.length >= count ? (optionalString(asRecord(transactions.at(-1)).created_at) ?? null) : null;
    const states: Record<string, number> = {};
    for (const transaction of transactions) {
      const state = optionalString(asRecord(transaction).state) ?? "unknown";
      states[state] = (states[state] ?? 0) + 1;
    }
    return {
      count: transactions.length,
      more_available: nextPageTo !== null,
      next_page_to: nextPageTo,
      states,
      transactions:
        input.detail === "full" ? transactions : transactions.map((transaction) => compactTransaction(transaction)),
    };
  },
  get_transaction(input, context) {
    return revolutRequest(
      context,
      `/transaction/${encodeURIComponent(requiredString(input.transaction_id, "transaction_id"))}`,
    );
  },
  async list_counterparties(input, context) {
    const accountNumber = optionalString(input.account_no);
    const iban = optionalString(input.iban);
    if (optionalString(input.sort_code) && !accountNumber) {
      throw new ProviderRequestError(400, "sort_code may only be used together with account_no.");
    }
    if (optionalString(input.bic) && !iban) {
      throw new ProviderRequestError(400, "bic may only be used together with iban.");
    }
    const limit = optionalInteger(input.limit) ?? defaultCounterpartyLimit;
    const counterparties = arrayPayload(
      await revolutRequest(context, "/counterparties", {
        query: definedQuery({
          name: optionalString(input.name),
          account_no: accountNumber,
          sort_code: optionalString(input.sort_code),
          iban,
          bic: optionalString(input.bic),
          created_before: optionalString(input.created_before),
          limit,
        }),
      }),
      "Revolut counterparties",
    );
    const nextPage =
      counterparties.length >= limit ? (optionalString(asRecord(counterparties.at(-1)).created_at) ?? null) : null;
    return {
      count: counterparties.length,
      more_available: nextPage !== null,
      next_page_created_before: nextPage,
      counterparties,
    };
  },
  get_counterparty(input, context) {
    return getCounterparty(requiredString(input.counterparty_id, "counterparty_id"), context);
  },
  async create_payment_draft(input, context) {
    const accountId = requiredString(input.account_id, "account_id");
    const counterpartyId = requiredString(input.counterparty_id, "counterparty_id");
    const receiverAccountId = optionalString(input.receiver_account_id);
    const amount = optionalNumber(input.amount);
    const currency = requiredString(input.currency, "currency");
    const reference = requiredString(input.reference, "reference");
    if (amount === undefined || !Number.isFinite(amount) || amount <= 0) {
      throw new ProviderRequestError(400, "amount must be greater than zero.");
    }

    let counterparty: Record<string, unknown>;
    try {
      counterparty = await getCounterparty(counterpartyId, context);
    } catch (error) {
      throw new ProviderRequestError(
        400,
        `Counterparty ${counterpartyId} could not be read. Add or repair it in Revolut Business before creating a draft.`,
        error,
      );
    }
    if (counterparty.state !== "created") {
      throw new ProviderRequestError(400, `Counterparty ${counterpartyId} is not in the created state.`);
    }
    const methods = collectReceiverMethods(counterparty);
    const receiver: Record<string, string> = { counterparty_id: counterpartyId };
    if (receiverAccountId) {
      const selected = methods.find((method) => method.id === receiverAccountId);
      if (!selected) {
        throw new ProviderRequestError(
          400,
          `receiver_account_id is not one of this counterparty's receiving methods: ${methods
            .map((method) => method.id)
            .join(", ")}`,
        );
      }
      receiver[selected.kind === "card" ? "card_id" : "account_id"] = selected.id;
    } else if (methods.length > 1) {
      throw new ProviderRequestError(
        400,
        `This counterparty has ${methods.length} receiving methods; pass receiver_account_id explicitly.`,
      );
    } else if (methods.length === 1) {
      const selected = methods[0]!;
      receiver[selected.kind === "card" ? "card_id" : "account_id"] = selected.id;
    }

    const payingAccount = objectPayload(
      await revolutRequest(context, `/accounts/${encodeURIComponent(accountId)}`),
      "Revolut paying account",
    );
    if (payingAccount.state !== "active") {
      throw new ProviderRequestError(400, `Paying account ${accountId} is not active.`);
    }

    const duplicateId = await findDuplicateDraft(context, counterpartyId, amount, currency, reference);
    if (duplicateId) {
      throw new ProviderRequestError(
        409,
        `A pending API payment draft with the same counterparty, amount, currency, and reference already exists (${duplicateId}).`,
      );
    }

    const operator = requireOperator(context.metadata);
    const rawTitle = optionalString(input.title) ?? reference;
    const title = `[${operator} via OpenConnector] ${rawTitle}`.slice(0, maxDraftTitleLength);
    const payment = definedBody({
      account_id: accountId,
      receiver,
      amount,
      currency,
      reference,
      transfer_reason_code: optionalString(input.transfer_reason_code),
    });
    const result = objectPayload(
      await revolutRequest(context, "/payment-drafts", {
        method: "POST",
        body: definedBody({
          title,
          schedule_for: optionalString(input.schedule_for),
          payments: [payment],
        }),
      }),
      "Revolut payment draft",
    );
    return {
      id: optionalString(result.id) ?? null,
      title,
      receiver,
      reminder: "Draft created. It will not be paid until a human approves it in Revolut Business.",
    };
  },
  list_payment_drafts(_input, context) {
    return revolutRequest(context, "/payment-drafts", { query: { source: "api" } });
  },
  get_payment_draft(input, context) {
    return revolutRequest(context, `/payment-drafts/${encodeURIComponent(requiredString(input.draft_id, "draft_id"))}`);
  },
};

export const executors: ProviderExecutors = defineOAuthProviderExecutors(service, revolutActionHandlers);

export const credentialValidators: CredentialValidators = {
  async oauth2(input, { fetcher, signal }) {
    const context: RevolutContext = {
      accessToken: input.accessToken,
      fetcher,
      metadata: input.metadata,
      signal,
    };
    const accounts = arrayPayload(await revolutRequest(context, "/accounts"), "Revolut accounts");
    const first = asRecord(accounts[0]);
    const accountId = optionalString(first.id) ?? "revolut-business";
    return {
      profile: {
        accountId,
        displayName: optionalString(first.name) ?? "Revolut Business",
      },
      grantedScopes: readGrantedScopes(input.metadata),
      metadata: {
        apiBaseUrl: resolveApiBaseUrl(input.metadata),
        operator: requireOperator(input.metadata),
      },
    };
  },
};

type RevolutContext = Pick<OAuthProviderContext, "accessToken" | "fetcher" | "metadata" | "signal">;
type RevolutHandler = ProviderRuntimeHandler<OAuthProviderContext>;

interface RevolutRequestOptions {
  method?: string;
  query?: Record<string, string | number>;
  body?: unknown;
}

async function revolutRequest(context: RevolutContext, path: string, options: RevolutRequestOptions = {}) {
  return requestJson({
    providerName: "Revolut",
    baseUrl: resolveApiBaseUrl(context.metadata),
    path,
    fetcher: context.fetcher,
    signal: context.signal,
    method: options.method,
    query: options.query,
    body: options.body,
    headers: {
      authorization: `Bearer ${context.accessToken}`,
    },
  });
}

function resolveApiBaseUrl(metadata: Record<string, unknown> | undefined): string {
  const configured = readOAuthClientExtra(metadata);
  const apiBaseUrl = optionalString(configured.apiBaseUrl)?.replace(/\/+$/u, "");
  if (!apiBaseUrl || !allowedApiBaseUrls.has(apiBaseUrl)) {
    throw new ProviderRequestError(
      400,
      "Revolut apiBaseUrl must be the documented sandbox or production Business API URL.",
    );
  }
  return apiBaseUrl;
}

function requireOperator(metadata: Record<string, unknown> | undefined): string {
  const operator = optionalString(readOAuthClientExtra(metadata).operator);
  if (!operator) {
    throw new ProviderRequestError(400, "Revolut operator is missing from the OAuth client configuration.");
  }
  return operator;
}

function readOAuthClientExtra(metadata: Record<string, unknown> | undefined): Record<string, unknown> {
  if (!metadata) return {};
  const direct = optionalRecord(metadata.oauthClientExtra);
  if (direct) return direct;
  return optionalRecord(optionalRecord(metadata.oauthClientConfig)?.extra) ?? {};
}

function readGrantedScopes(metadata: Record<string, unknown>): string[] {
  const scope = optionalString(metadata.scope);
  return scope ? scope.split(/[\s,]+/u).filter(Boolean) : [];
}

function definedQuery(input: Record<string, string | number | undefined>): Record<string, string | number> {
  return Object.fromEntries(
    Object.entries(input).filter((entry): entry is [string, string | number] => entry[1] !== undefined),
  );
}

function compactTransaction(value: unknown): Record<string, unknown> {
  const transaction = asRecord(value);
  const legs = Array.isArray(transaction.legs) ? transaction.legs.map(asRecord) : [];
  const row: Record<string, unknown> = {
    id: transaction.id,
    created_at: transaction.created_at,
    state: transaction.state,
    type: transaction.type,
  };
  if (transaction.reason_code !== undefined) row.reason_code = transaction.reason_code;
  if (transaction.reference !== undefined) row.reference = transaction.reference;
  if (legs.length === 1) {
    row.amount = legs[0]!.amount;
    row.currency = legs[0]!.currency;
    row.description = legs[0]!.description;
  } else if (legs.length > 1) {
    row.legs = legs.map((leg) => ({
      amount: leg.amount,
      currency: leg.currency,
      description: leg.description,
    }));
  }
  const merchant = optionalRecord(transaction.merchant);
  if (merchant?.name !== undefined) row.counterparty = merchant.name;
  return row;
}

interface ReceiverMethod {
  id: string;
  kind: "account" | "card";
}

function collectReceiverMethods(counterparty: Record<string, unknown>): ReceiverMethod[] {
  return [
    ...readRecordArray(counterparty.accounts).flatMap((account) => {
      const id = optionalString(account.id);
      return id ? [{ id, kind: "account" as const }] : [];
    }),
    ...readRecordArray(counterparty.cards).flatMap((card) => {
      const id = optionalString(card.id);
      return id ? [{ id, kind: "card" as const }] : [];
    }),
  ];
}

async function getCounterparty(counterpartyId: string, context: RevolutContext): Promise<Record<string, unknown>> {
  return objectPayload(
    await revolutRequest(context, `/counterparty/${encodeURIComponent(counterpartyId)}`),
    "Revolut counterparty",
  );
}

async function findDuplicateDraft(
  context: RevolutContext,
  counterpartyId: string,
  amount: number,
  currency: string,
  reference: string,
): Promise<string | null> {
  let list: Record<string, unknown>;
  try {
    list = objectPayload(
      await revolutRequest(context, "/payment-drafts", { query: { source: "api" } }),
      "Revolut payment drafts",
    );
  } catch (error) {
    throw new ProviderRequestError(409, "Could not check existing Revolut drafts; failing closed.", error);
  }
  for (const order of readRecordArray(list.payment_orders)) {
    const draftId = optionalString(order.id);
    if (!draftId) continue;
    let draft: Record<string, unknown>;
    try {
      draft = objectPayload(
        await revolutRequest(context, `/payment-drafts/${encodeURIComponent(draftId)}`),
        "Revolut payment draft",
      );
    } catch (error) {
      throw new ProviderRequestError(409, "Could not inspect an existing Revolut draft; failing closed.", error);
    }
    if (
      readRecordArray(draft.payments).some((payment) =>
        paymentMatches(payment, counterpartyId, amount, currency, reference),
      )
    ) {
      return draftId;
    }
  }
  return null;
}

function paymentMatches(
  payment: Record<string, unknown>,
  counterpartyId: string,
  amount: number,
  currency: string,
  reference: string,
): boolean {
  if (optionalRecord(payment.receiver)?.counterparty_id !== counterpartyId || payment.reference !== reference) {
    return false;
  }
  const amountObject = optionalRecord(payment.amount);
  const paidAmount = amountObject?.amount ?? payment.amount;
  const paidCurrency = amountObject?.currency ?? payment.currency;
  return Number(paidAmount) === amount && paidCurrency === currency;
}

function readRecordArray(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.map(asRecord) : [];
}

function asRecord(value: unknown): Record<string, unknown> {
  return optionalRecord(value) ?? {};
}
