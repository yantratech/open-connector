import type { ActionDefinition } from "../../core/types.ts";

import { s } from "../../core/json-schema.ts";
import { defineProviderAction } from "../../core/provider-definition.ts";

export const xeroAssetActions: ActionDefinition[] = [
  {
    name: "list_assets",
    description: "List fixed assets by status, with bounded pagination.",
    requiredScopes: ["assets.read"],
    inputSchema: s.object(
      {
        tenant_id: s.uuid("The connected organisation ID."),
        status: s.stringEnum(["DRAFT", "REGISTERED", "DISPOSED"]),
        page: s.integer({ minimum: 1, default: 1 }),
        page_size: s.integer({ minimum: 1, maximum: 200, default: 50 }),
        order_by: s.string(),
        sort_direction: s.stringEnum(["ASC", "DESC"]),
        filter_by: s.string(),
      },
      { required: ["status"] },
    ),
    outputSchema: s.looseObject(
      "The Xero response, including provider validation details and pagination when returned.",
    ),
  },
  {
    name: "list_asset_types",
    description: "List asset types with their depreciation defaults.",
    requiredScopes: ["assets.read"],
    inputSchema: s.object({ tenant_id: s.uuid("The connected organisation ID.") }, { required: [] }),
    outputSchema: s.array(s.looseObject("An asset type and its depreciation settings.")),
  },
  {
    name: "get_asset",
    description: "Read one fixed asset.",
    requiredScopes: ["assets.read"],
    inputSchema: s.object(
      { tenant_id: s.uuid("The connected organisation ID."), asset_id: s.uuid("The asset ID.") },
      { required: ["asset_id"] },
    ),
    outputSchema: s.looseObject(
      "The Xero response, including provider validation details and pagination when returned.",
    ),
  },
  {
    name: "get_asset_settings",
    description: "Read the organisation's fixed asset settings.",
    requiredScopes: ["assets.read"],
    inputSchema: s.object({ tenant_id: s.uuid("The connected organisation ID.") }, { required: [] }),
    outputSchema: s.looseObject(
      "The Xero response, including provider validation details and pagination when returned.",
    ),
  },
  {
    name: "create_asset",
    description:
      "Create an asset using its selected asset type's book depreciation settings. The type is resolved before the write.",
    requiredScopes: ["assets", "assets.read"],
    inputSchema: s.object(
      {
        tenant_id: s.uuid("The connected organisation ID."),
        asset_name: s.nonEmptyString("The asset name."),
        asset_number: s.nonEmptyString("The unique asset number."),
        asset_type_id: s.uuid("The asset type."),
        purchase_date: s.date("The purchase date."),
        purchase_price: s.number({ minimum: 0 }),
        serial_number: s.string(),
        warranty_expiry_date: s.date("The warranty expiry date."),
        depreciation_start_date: s.date("The depreciation start date."),
        idempotency_key: s.string({ minLength: 1, maxLength: 128 }),
      },
      { required: ["asset_name", "asset_number", "asset_type_id", "purchase_date", "purchase_price"] },
    ),
    outputSchema: s.looseObject(
      "The Xero response, including provider validation details and pagination when returned.",
    ),
  },
  {
    name: "create_asset_type",
    description:
      "Create an asset type with explicit accounts and depreciation settings. Rate values are passed through in Xero's native representation.",
    requiredScopes: ["assets"],
    inputSchema: s.object(
      {
        tenant_id: s.uuid("The connected organisation ID."),
        asset_type_name: s.nonEmptyString("The type name."),
        fixed_asset_account_id: s.uuid("The fixed asset account."),
        depreciation_expense_account_id: s.uuid("The depreciation expense account."),
        accumulated_depreciation_account_id: s.uuid("The accumulated depreciation account."),
        book_depreciation_setting: s.object(
          {
            depreciation_method: s.stringEnum([
              "NoDepreciation",
              "StraightLine",
              "DiminishingValue100",
              "DiminishingValue150",
              "DiminishingValue200",
              "FullDepreciation",
            ]),
            averaging_method: s.stringEnum(["FullMonth", "ActualDays"]),
            depreciation_calculation_method: s.stringEnum(["Rate", "Life", "None"]),
            depreciation_rate: s.number(
              "Xero depreciation-rate value, passed unchanged; use the same representation as an existing asset type.",
              { minimum: 0 },
            ),
            effective_life_years: s.positiveInteger("The useful lifetime in years."),
          },
          { required: ["depreciation_method"] },
        ),
        idempotency_key: s.string({ minLength: 1, maxLength: 128 }),
      },
      {
        required: [
          "asset_type_name",
          "fixed_asset_account_id",
          "depreciation_expense_account_id",
          "accumulated_depreciation_account_id",
          "book_depreciation_setting",
        ],
      },
    ),
    outputSchema: s.looseObject(
      "The Xero response, including provider validation details and pagination when returned.",
    ),
  },
].map((action) => defineProviderAction("xero", action));
