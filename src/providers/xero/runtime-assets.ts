import type { ProviderActionHandlerSubset, ProviderRuntimeHandler, OAuthProviderContext } from "../provider-runtime.ts";

import { optionalScalarString, optionalString, recordOrEmpty } from "../../core/cast.ts";
import { optionalRecord, requiredRecord } from "../../core/cast.ts";
import { providerInputError } from "../provider-runtime.ts";
import { providerResponseError } from "../provider-runtime.ts";
import { xeroRequest, resolveTenantId, requireXeroGuid, xeroApiBases } from "./runtime-request.ts";
export const xeroAssetHandlers: ProviderActionHandlerSubset<"xero", ProviderRuntimeHandler<OAuthProviderContext>> = {
  async list_assets(input, context) {
    const tenantId = await resolveTenantId(input, context);
    return xeroRequest(context, {
      tenantId,
      baseUrl: xeroApiBases.assets,
      path: "/Assets",
      query: {
        status: optionalString(input.status),
        page: optionalScalarString(input.page),
        pageSize: optionalScalarString(input.page_size),
        orderBy: optionalString(input.order_by),
        sortDirection: optionalString(input.sort_direction),
        filterBy: optionalString(input.filter_by),
      },
    });
  },
  async list_asset_types(input, context) {
    const tenantId = await resolveTenantId(input, context);
    return xeroRequest(context, { tenantId, baseUrl: xeroApiBases.assets, path: "/AssetTypes" });
  },
  async get_asset(input, context) {
    const tenantId = await resolveTenantId(input, context);
    return xeroRequest(context, {
      tenantId,
      baseUrl: xeroApiBases.assets,
      path: `/Assets/${requireXeroGuid(input.asset_id, "asset_id")}`,
    });
  },
  async get_asset_settings(input, context) {
    const tenantId = await resolveTenantId(input, context);
    return xeroRequest(context, { tenantId, baseUrl: xeroApiBases.assets, path: "/Settings" });
  },
  async create_asset(input, context) {
    const tenantId = await resolveTenantId(input, context);
    const types = await xeroRequest(context, { tenantId, baseUrl: xeroApiBases.assets, path: "/AssetTypes" });
    if (!Array.isArray(types)) throw providerResponseError("Xero returned an invalid asset type list.");
    const type = types.map(recordOrEmpty).find((row) => row.assetTypeId === input.asset_type_id);
    if (!type || !optionalRecord(type.bookDepreciationSetting))
      throw providerInputError("The selected asset type was not found or has no book depreciation settings.");
    return xeroRequest(context, {
      tenantId,
      baseUrl: xeroApiBases.assets,
      path: "/Assets",
      method: "POST",
      idempotencyKey: optionalString(input.idempotency_key),
      body: {
        assetName: input.asset_name,
        assetNumber: input.asset_number,
        assetTypeId: input.asset_type_id,
        purchaseDate: input.purchase_date,
        purchasePrice: input.purchase_price,
        serialNumber: input.serial_number,
        warrantyExpiryDate: input.warranty_expiry_date,
        bookDepreciationSetting: assetDepreciationDefaults(type.bookDepreciationSetting),
        bookDepreciationDetail:
          input.depreciation_start_date === undefined
            ? undefined
            : { depreciationStartDate: input.depreciation_start_date },
      },
    });
  },
  async create_asset_type(input, context) {
    const tenantId = await resolveTenantId(input, context);
    const setting = requiredRecord(input.book_depreciation_setting, "book_depreciation_setting", providerInputError);
    if (setting.depreciation_calculation_method === "Rate" && setting.depreciation_rate === undefined)
      throw providerInputError("A rate calculation requires depreciation_rate.");
    if (setting.depreciation_calculation_method === "Life" && setting.effective_life_years === undefined)
      throw providerInputError("A life calculation requires effective_life_years.");
    return xeroRequest(context, {
      tenantId,
      baseUrl: xeroApiBases.assets,
      path: "/AssetTypes",
      method: "POST",
      idempotencyKey: optionalString(input.idempotency_key),
      body: {
        assetTypeName: input.asset_type_name,
        fixedAssetAccountId: input.fixed_asset_account_id,
        depreciationExpenseAccountId: input.depreciation_expense_account_id,
        accumulatedDepreciationAccountId: input.accumulated_depreciation_account_id,
        bookDepreciationSetting: {
          depreciationMethod: setting.depreciation_method,
          averagingMethod: setting.averaging_method,
          depreciationCalculationMethod: setting.depreciation_calculation_method,
          depreciationRate: setting.depreciation_rate,
          effectiveLifeYears: setting.effective_life_years,
        },
      },
    });
  },
};

function assetDepreciationDefaults(value: unknown): Record<string, unknown> {
  const setting = recordOrEmpty(value);
  return {
    depreciationMethod: setting.depreciationMethod,
    averagingMethod: setting.averagingMethod,
    depreciationCalculationMethod: setting.depreciationCalculationMethod,
    depreciationRate: setting.depreciationRate,
    effectiveLifeYears: setting.effectiveLifeYears,
  };
}
