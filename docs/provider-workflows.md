# Drata, Kandji and Xero workflows

These providers use the normal OpenConnector credential, action and transit-file APIs. Discover the current input schemas and required permissions through the catalog before executing an action.

| Provider | Actions | Coverage                                                                                                                                                                    |
| -------- | ------: | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Drata    |     144 | Controls, evidence, personnel, devices, vendors and security reviews, policies, risks, audits, tasks, custom connections, compliance summaries and linked GitHub inspection |
| Kandji   |     114 | Device inventory and commands, blueprints, library items, enrollment, Apps & Books, Automated Device Enrollment, integrations, tags and all 16 Prism categories             |
| Xero     |     148 | Accounting reads and writes, reports, attachments, Files, Projects, fixed assets and New Zealand Payroll timesheets and leave                                               |

## Credentials

Drata uses an API key and its configured region. The four GitHub inspection actions additionally require the optional `githubToken` credential field; that token is sent only to GitHub. Drata test IDs and monitor IDs are separate identifiers. Use the matching input field rather than assuming that equal numeric values identify the same test.

Kandji uses the tenant API URL and an API token. The deployment's network policy still applies to that URL and every request. Some actions enqueue device commands; an accepted command does not mean the device has completed it. `erase_device` returns the generated six-digit PIN with the queued result.

Xero uses a user OAuth connection. The provider requests identity, refresh and action-specific scopes from the catalog, including the current granular Accounting scopes. Existing connections may need reauthorization for the added API families. Apps also need access to the corresponding Xero products and permissions. When a token covers multiple organisations, pass `tenant_id` explicitly using an ID returned by `list_organisations`.

Payroll actions implement the **New Zealand** contract. They check the selected organisation's `Version` before calling Payroll; UK and other regions are rejected. This discovery step also requires `accounting.settings.read`.

## Pagination and computed results

Drata has both legacy page/limit APIs and newer cursor APIs. Actions preserve the applicable continuation metadata. `fetchAll` follows pages only up to the declared result budget. A null total means the complete query size is unknown; it is not a zero count. Computed compliance results expose completeness and keep unknown compliance separate from a reported failure. A failed or incomplete vendor-review lookup does not prove that no review exists.

Kandji collection actions return bounded results and continuation offsets. Prism summary and export actions use the same bounded retrieval; consult their completeness metadata before treating a result as the entire fleet.

Xero collection actions expose the pagination supported by each API. Report results retain headings, nested rows and every comparison column. Native actions include `search_contacts`, `search_invoices`, `search_bank_transactions`, `get_organisation`, `get_profit_and_loss` and `get_balance_sheet`. `update_invoice_status` covers submission, approval, voiding and deletion with a current-status check.

## Writes and files

Financial document edits in Xero are deliberately limited to draft invoices, credit notes, quotes, purchase orders and manual journals. Bank-transaction edits require an authorised, unreconciled transaction. Supplied line collections replace the full line set; include the existing `line_item_id` to retain line identity. Manual journals must balance at four-decimal precision. Payments are checked against the invoice's current status and outstanding amount before writing; Xero remains the final authority.

Batch contact and invoice writes may update matching records. Their results preserve individual errors and warnings even when the HTTP request succeeds. Tracking-option batches report each attempted write and stop after a transport or server failure. Mutations are not automatically retried. Where supported, `idempotency_key` allows a caller to identify a retry of the same request.

Uploads take transit-file references. Downloads return transit-file metadata and a download URL. Provider actions do not read or write arbitrary local paths. Xero Files documents and Accounting attachments are separate resources: a Files association is not an Accounting attachment. Uploading an Accounting attachment with an existing filename can replace it. Xero uploads are limited to 10 MB; a lower configured transit-file limit still applies.

The Xero surface covers current API families. Deprecated Classic Expenses receipt actions and external exchange-rate lookups are not included. Use transit files directly for file preparation. Drata's supported external-evidence download action is `get_external_evidence_download_url`; there is no general control-evidence download endpoint.

API contracts were checked against the [official Xero OpenAPI definitions](https://github.com/XeroAPI/Xero-OpenAPI), [Drata developer documentation](https://developers.drata.com/) and [Kandji API documentation](https://api-docs.kandji.io/). Account-specific entitlements and provider-side validation still apply.
