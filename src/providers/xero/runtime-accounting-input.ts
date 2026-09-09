import { compactObject, objectArray, recordOrEmpty } from "../../core/cast.ts";
import { providerInputError } from "../provider-runtime.ts";
function mapXeroPhone(input: Record<string, unknown>): Record<string, unknown> {
  return compactObject({
    PhoneType: input.phone_type,
    PhoneNumber: input.phone_number,
    PhoneAreaCode: input.phone_area_code,
    PhoneCountryCode: input.phone_country_code,
  });
}
function mapXeroAddress(input: Record<string, unknown>): Record<string, unknown> {
  return compactObject({
    AddressType: input.address_type,
    AddressLine1: input.address_line1,
    AddressLine2: input.address_line2,
    AddressLine3: input.address_line3,
    AddressLine4: input.address_line4,
    City: input.city,
    Region: input.region,
    PostalCode: input.postal_code,
    Country: input.country,
    AttentionTo: input.attention_to,
  });
}
function mapXeroPurchase(input: Record<string, unknown>): Record<string, unknown> {
  return compactObject({
    UnitPrice: input.unit_price,
    AccountCode: input.account_code,
    COGSAccountCode: input.cogs_account_code,
    TaxType: input.tax_type,
  });
}
function mapXeroSchedule(input: Record<string, unknown>): Record<string, unknown> {
  return compactObject({
    Period: input.period,
    Unit: input.unit,
    DueDate: input.due_date,
    DueDateType: input.due_date_type,
    StartDate: input.start_date,
    EndDate: input.end_date,
  });
}
function mapXeroManualJournalLine(input: Record<string, unknown>): Record<string, unknown> {
  return compactObject({
    LineAmount: input.line_amount,
    AccountCode: input.account_code,
    AccountID: input.account_id,
    Description: input.description,
    TaxType: input.tax_type,
    TaxAmount: input.tax_amount,
    Tracking:
      input.tracking === undefined
        ? undefined
        : objectArray(input.tracking, "tracking", providerInputError).map((value) => ({
            TrackingCategoryID: value.tracking_category_id,
            TrackingOptionID: value.tracking_option_id,
          })),
  });
}
function mapXeroLineItem(input: Record<string, unknown>): Record<string, unknown> {
  return compactObject({
    LineItemID: input.line_item_id,
    Description: input.description,
    Quantity: input.quantity,
    UnitAmount: input.unit_amount,
    ItemCode: input.item_code,
    AccountCode: input.account_code,
    AccountID: input.account_id,
    TaxType: input.tax_type,
    TaxAmount: input.tax_amount,
    DiscountRate: input.discount_rate,
    DiscountAmount: input.discount_amount,
    Tracking:
      input.tracking === undefined
        ? undefined
        : objectArray(input.tracking, "tracking", providerInputError).map((value) => ({
            TrackingCategoryID: value.tracking_category_id,
            TrackingOptionID: value.tracking_option_id,
          })),
  });
}
export function mapXeroLinkedTransaction(input: Record<string, unknown>): Record<string, unknown> {
  return compactObject({
    SourceTransactionID: input.source_transaction_id,
    SourceLineItemID: input.source_line_item_id,
    ContactID: input.contact_id,
    TargetTransactionID: input.target_transaction_id,
    TargetLineItemID: input.target_line_item_id,
  });
}
export function mapXeroManualJournal(input: Record<string, unknown>): Record<string, unknown> {
  return compactObject({
    Narration: input.narration,
    Date: input.date,
    LineAmountTypes: input.line_amount_types,
    Url: input.url,
    ShowOnCashBasisReports: input.show_on_cash_basis_reports,
    JournalLines:
      input.journal_lines === undefined
        ? undefined
        : objectArray(input.journal_lines, "journal_lines", providerInputError).map(mapXeroManualJournalLine),
  });
}
export function mapXeroItem(input: Record<string, unknown>): Record<string, unknown> {
  return compactObject({
    Code: input.code,
    InventoryAssetAccountCode: input.inventory_asset_account_code,
    Name: input.name,
    IsSold: input.is_sold,
    IsPurchased: input.is_purchased,
    Description: input.description,
    PurchaseDescription: input.purchase_description,
    IsTrackedAsInventory: input.is_tracked_as_inventory,
    PurchaseDetails:
      input.purchase_details === undefined ? undefined : mapXeroPurchase(recordOrEmpty(input.purchase_details)),
    SalesDetails: input.sales_details === undefined ? undefined : mapXeroPurchase(recordOrEmpty(input.sales_details)),
  });
}
export function mapXeroAccount(input: Record<string, unknown>): Record<string, unknown> {
  return compactObject({
    Code: input.code,
    Name: input.name,
    Type: input.type,
    BankAccountNumber: input.bank_account_number,
    Description: input.description,
    BankAccountType: input.bank_account_type,
    CurrencyCode: input.currency_code,
    TaxType: input.tax_type,
    EnablePaymentsToAccount: input.enable_payments_to_account,
    ShowInExpenseClaims: input.show_in_expense_claims,
    AddToWatchlist: input.add_to_watchlist,
  });
}
export function mapXeroRepeatingInvoice(input: Record<string, unknown>): Record<string, unknown> {
  return compactObject({
    Type: input.type,
    LineAmountTypes: input.line_amount_types,
    Reference: input.reference,
    BrandingThemeID: input.branding_theme_id,
    CurrencyCode: input.currency_code,
    ApprovedForSending: input.approved_for_sending,
    SendCopy: input.send_copy,
    MarkAsSent: input.mark_as_sent,
    IncludePDF: input.include_pdf,
    Contact: input.contact_id === undefined ? undefined : { ContactID: input.contact_id },
    LineItems:
      input.line_items === undefined
        ? undefined
        : objectArray(input.line_items, "line_items", providerInputError).map(mapXeroLineItem),
    Schedule: input.schedule === undefined ? undefined : mapXeroSchedule(recordOrEmpty(input.schedule)),
  });
}
export function mapXeroPurchaseOrder(input: Record<string, unknown>): Record<string, unknown> {
  return compactObject({
    Date: input.date,
    DeliveryDate: input.delivery_date,
    LineAmountTypes: input.line_amount_types,
    PurchaseOrderNumber: input.purchase_order_number,
    Reference: input.reference,
    BrandingThemeID: input.branding_theme_id,
    CurrencyCode: input.currency_code,
    DeliveryAddress: input.delivery_address,
    AttentionTo: input.attention_to,
    Telephone: input.telephone,
    DeliveryInstructions: input.delivery_instructions,
    ExpectedArrivalDate: input.expected_arrival_date,
    CurrencyRate: input.currency_rate,
    Contact: input.contact_id === undefined ? undefined : { ContactID: input.contact_id },
    LineItems:
      input.line_items === undefined
        ? undefined
        : objectArray(input.line_items, "line_items", providerInputError).map(mapXeroLineItem),
  });
}
export function mapXeroQuote(input: Record<string, unknown>): Record<string, unknown> {
  return compactObject({
    QuoteNumber: input.quote_number,
    Reference: input.reference,
    Terms: input.terms,
    Date: input.date,
    ExpiryDate: input.expiry_date,
    CurrencyCode: input.currency_code,
    CurrencyRate: input.currency_rate,
    Title: input.title,
    Summary: input.summary,
    BrandingThemeID: input.branding_theme_id,
    LineAmountTypes: input.line_amount_types,
    Contact: input.contact_id === undefined ? undefined : { ContactID: input.contact_id },
    LineItems:
      input.line_items === undefined
        ? undefined
        : objectArray(input.line_items, "line_items", providerInputError).map(mapXeroLineItem),
  });
}
export function mapXeroCreditNote(input: Record<string, unknown>): Record<string, unknown> {
  return compactObject({
    Type: input.type,
    Date: input.date,
    DueDate: input.due_date,
    LineAmountTypes: input.line_amount_types,
    CreditNoteNumber: input.credit_note_number,
    Reference: input.reference,
    CurrencyCode: input.currency_code,
    CurrencyRate: input.currency_rate,
    BrandingThemeID: input.branding_theme_id,
    Contact: input.contact_id === undefined ? undefined : { ContactID: input.contact_id },
    LineItems:
      input.line_items === undefined
        ? undefined
        : objectArray(input.line_items, "line_items", providerInputError).map(mapXeroLineItem),
  });
}
export function mapXeroBankTransaction(input: Record<string, unknown>): Record<string, unknown> {
  return compactObject({
    Type: input.type,
    Date: input.date,
    Reference: input.reference,
    CurrencyCode: input.currency_code,
    CurrencyRate: input.currency_rate,
    Url: input.url,
    LineAmountTypes: input.line_amount_types,
    Contact: input.contact_id === undefined ? undefined : { ContactID: input.contact_id },
    LineItems:
      input.line_items === undefined
        ? undefined
        : objectArray(input.line_items, "line_items", providerInputError).map(mapXeroLineItem),
    BankAccount: input.bank_account_id === undefined ? undefined : { AccountID: input.bank_account_id },
  });
}
export function mapXeroInvoice(input: Record<string, unknown>): Record<string, unknown> {
  return compactObject({
    Type: input.type,
    Date: input.date,
    DueDate: input.due_date,
    LineAmountTypes: input.line_amount_types,
    InvoiceNumber: input.invoice_number,
    Reference: input.reference,
    CurrencyCode: input.currency_code,
    CurrencyRate: input.currency_rate,
    BrandingThemeID: input.branding_theme_id,
    Url: input.url,
    ExpectedPaymentDate: input.expected_payment_date,
    PlannedPaymentDate: input.planned_payment_date,
    Contact: input.contact_id === undefined ? undefined : { ContactID: input.contact_id },
    LineItems:
      input.line_items === undefined
        ? undefined
        : objectArray(input.line_items, "line_items", providerInputError).map(mapXeroLineItem),
  });
}
export function mapXeroContact(input: Record<string, unknown>): Record<string, unknown> {
  return compactObject({
    Name: input.name,
    FirstName: input.first_name,
    LastName: input.last_name,
    EmailAddress: input.email_address,
    AccountNumber: input.account_number,
    ContactNumber: input.contact_number,
    CompanyNumber: input.company_number,
    TaxNumber: input.tax_number,
    BankAccountDetails: input.bank_account_details,
    Website: input.website,
    DefaultCurrency: input.default_currency,
    SalesDefaultAccountCode: input.sales_default_account_code,
    PurchasesDefaultAccountCode: input.purchases_default_account_code,
    AccountsReceivableTaxType: input.accounts_receivable_tax_type,
    AccountsPayableTaxType: input.accounts_payable_tax_type,
    Discount: input.discount,
    Addresses:
      input.addresses === undefined
        ? undefined
        : objectArray(input.addresses, "addresses", providerInputError).map(mapXeroAddress),
    Phones:
      input.phones === undefined
        ? undefined
        : objectArray(input.phones, "phones", providerInputError).map(mapXeroPhone),
  });
}
