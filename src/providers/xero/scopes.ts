/**
 * Xero OAuth2 scopes (granular scope family). Apps created after 2 March 2026
 * only have access to the granular scopes listed here; the older broad scopes
 * such as `accounting.transactions.read` and `accounting.reports.read` are
 * deprecated for new apps and are NOT requested by this provider:
 * https://developer.xero.com/documentation/guides/oauth2/scopes
 *
 * `app.connections` is also left out on purpose: it is meant for
 * client-credentials Custom Connection apps, requesting it on a web-app
 * authorize URL returned access_denied ("Requested wrong apps scopes") in
 * testing, and GET /connections works with a user access token without it.
 */
export const xeroSettingsReadScope = "accounting.settings.read";
export const xeroContactsReadScope = "accounting.contacts.read";
export const xeroInvoicesReadScope = "accounting.invoices.read";
export const xeroBankTransactionsReadScope = "accounting.banktransactions.read";
export const xeroPaymentsReadScope = "accounting.payments.read";
export const xeroJournalsReadScope = "accounting.journals.read";
export const xeroProfitAndLossReadScope = "accounting.reports.profitandloss.read";
export const xeroBalanceSheetReadScope = "accounting.reports.balancesheet.read";
export const xeroContactsWriteScope = "accounting.contacts";
export const xeroInvoicesWriteScope = "accounting.invoices";
/** Identity and refresh scopes; resource scopes are derived from action definitions. */
export const xeroIdentityScopes: string[] = ["openid", "profile", "email", "offline_access"];
