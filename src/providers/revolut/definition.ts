import type { ProviderDefinition } from "../../core/types.ts";

import { revolutActions } from "./actions.ts";
import { revolutOAuthScopes } from "./scopes.ts";

const service = "revolut";

export const provider: ProviderDefinition = {
  service,
  displayName: "Revolut Business",
  description:
    "Read Revolut Business accounts and transactions, and prepare payment drafts that require human approval.",
  categories: ["Finance", "Productivity"],
  authTypes: ["oauth2"],
  auth: [
    {
      type: "oauth2",
      authorizationUrl: "{+webAppUrl}/app-confirm",
      tokenUrl: "{+apiBaseUrl}/auth/token",
      scopes: [...revolutOAuthScopes],
      scopeSeparator: ",",
      tokenEndpointAuthMethod: "private_key_jwt",
      tokenRequestFields: {
        clientId: false,
        authorizationCode: {
          redirectUri: false,
        },
      },
      privateKeyJwt: {
        privateKeyField: "privateKeyPem",
        audience: "https://revolut.com",
        issuer: "redirect_uri_host",
        lifetimeSeconds: 300,
      },
      clientConfigFields: [
        {
          key: "apiBaseUrl",
          label: "Business API URL",
          inputType: "text",
          required: true,
          secret: false,
          defaultValue: "https://sandbox-b2b.revolut.com/api/1.0",
          description: "Use the sandbox URL by default. For production use https://b2b.revolut.com/api/1.0.",
        },
        {
          key: "webAppUrl",
          label: "Business web app URL",
          inputType: "text",
          required: true,
          secret: false,
          defaultValue: "https://sandbox-business.revolut.com",
          description: "Use the sandbox URL by default. For production use https://business.revolut.com.",
        },
        {
          key: "operator",
          label: "Operator name",
          inputType: "text",
          required: true,
          secret: false,
          placeholder: "Borys",
          description: "Human operator name stamped onto every payment draft created by this connection.",
        },
        {
          key: "privateKeyPem",
          label: "RSA private key",
          inputType: "textarea",
          required: true,
          secret: true,
          location: "secretExtra",
          placeholder: "-----BEGIN PRIVATE KEY-----",
          description: "PKCS#8 PEM private key whose matching public certificate is registered with Revolut Business.",
        },
      ],
      clientSetup: {
        docsUrl: "https://developer.revolut.com/docs/guides/manage-accounts/get-started/make-your-first-api-request",
        steps: [
          "Create a Revolut Business API certificate and register this runtime's displayed OAuth callback URL as its redirect URI.",
          "Paste the certificate Client ID, the matching PKCS#8 RSA private key, and the operator name into this connection form.",
          "Keep the requested scopes at READ and WRITE; this provider never requests PAY.",
          "Complete the Revolut consent flow and approve the connection with two-factor authentication.",
        ],
      },
    },
  ],
  homepageUrl: "https://www.revolut.com/business/",
  actions: revolutActions,
};
