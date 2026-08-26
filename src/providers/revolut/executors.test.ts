import type { OAuthProviderContext } from "../provider-runtime.ts";

import { describe, expect, it, vi } from "vitest";
import { provider } from "./definition.ts";
import { revolutActionHandlers } from "./executors.ts";

const accountId = "11111111-1111-4111-8111-111111111111";
const counterpartyId = "22222222-2222-4222-8222-222222222222";
const receiverId = "33333333-3333-4333-8333-333333333333";

describe("Revolut Business provider", () => {
  it("requests READ and WRITE but never PAY, and encrypts the private key field", () => {
    const oauth = provider.auth.find((auth) => auth.type === "oauth2");

    expect(oauth?.scopes).toEqual(["READ", "WRITE"]);
    expect(oauth?.scopes).not.toContain("PAY");
    expect(oauth?.tokenEndpointAuthMethod).toBe("private_key_jwt");
    expect(oauth?.clientConfigFields?.find((field) => field.key === "privateKeyPem")).toMatchObject({
      location: "secretExtra",
      secret: true,
    });
  });

  it("creates an attributed draft only after validating the payee, account, and duplicate boundary", async () => {
    const fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input));
      if (url.pathname.endsWith(`/counterparty/${counterpartyId}`)) {
        return Response.json({
          id: counterpartyId,
          state: "created",
          accounts: [{ id: receiverId, currency: "GBP" }],
          cards: [],
        });
      }
      if (url.pathname.endsWith(`/accounts/${accountId}`)) {
        return Response.json({ id: accountId, state: "active" });
      }
      if (url.pathname.endsWith("/payment-drafts") && init?.method !== "POST") {
        expect(url.searchParams.get("source")).toBe("api");
        return Response.json({ payment_orders: [] });
      }
      if (url.pathname.endsWith("/payment-drafts") && init?.method === "POST") {
        const body = JSON.parse(String(init.body)) as Record<string, unknown>;
        expect(body).toMatchObject({
          title: "[Borys via OpenConnector] INV-42",
          payments: [
            {
              account_id: accountId,
              receiver: { counterparty_id: counterpartyId, account_id: receiverId },
              amount: 125,
              currency: "GBP",
              reference: "INV-42",
            },
          ],
        });
        return Response.json({ id: "44444444-4444-4444-8444-444444444444" });
      }
      return Response.json({ message: `Unexpected URL ${url}` }, { status: 500 });
    });

    await expect(
      revolutActionHandlers.create_payment_draft(
        {
          account_id: accountId,
          counterparty_id: counterpartyId,
          amount: 125,
          currency: "GBP",
          reference: "INV-42",
        },
        context(fetcher),
      ),
    ).resolves.toMatchObject({
      id: "44444444-4444-4444-8444-444444444444",
      title: "[Borys via OpenConnector] INV-42",
      reminder: expect.stringMatching(/human approves/i),
    });
    expect(fetcher.mock.calls.every(([input]) => !String(input).endsWith("/pay"))).toBe(true);
  });

  it("fails closed without posting when the pending-draft check fails", async () => {
    const fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input));
      if (url.pathname.endsWith(`/counterparty/${counterpartyId}`)) {
        return Response.json({ id: counterpartyId, state: "created", accounts: [], cards: [] });
      }
      if (url.pathname.endsWith(`/accounts/${accountId}`)) {
        return Response.json({ id: accountId, state: "active" });
      }
      if (url.pathname.endsWith("/payment-drafts") && init?.method !== "POST") {
        return Response.json({ message: "temporarily unavailable" }, { status: 503 });
      }
      return Response.json({ id: "should-not-exist" });
    });

    await expect(
      revolutActionHandlers.create_payment_draft(
        {
          account_id: accountId,
          counterparty_id: counterpartyId,
          amount: 125,
          currency: "GBP",
          reference: "INV-42",
        },
        context(fetcher),
      ),
    ).rejects.toMatchObject({ status: 409, message: expect.stringMatching(/failing closed/i) });
    expect(fetcher.mock.calls.some(([, init]) => init?.method === "POST")).toBe(false);
  });

  it("rejects an arbitrary API base URL before sending the bearer token", async () => {
    const fetcher = vi.fn();
    const invalidContext = context(fetcher);
    invalidContext.metadata = {
      oauthClientExtra: {
        apiBaseUrl: "https://attacker.example.com/api/1.0",
        operator: "Borys",
      },
    };

    await expect(revolutActionHandlers.list_accounts({}, invalidContext)).rejects.toMatchObject({ status: 400 });
    expect(fetcher).not.toHaveBeenCalled();
  });
});

function context(fetcher: OAuthProviderContext["fetcher"]): OAuthProviderContext {
  return {
    accessToken: "access-token",
    fetcher,
    metadata: {
      oauthClientExtra: {
        apiBaseUrl: "https://sandbox-b2b.revolut.com/api/1.0",
        operator: "Borys",
      },
    },
  };
}
