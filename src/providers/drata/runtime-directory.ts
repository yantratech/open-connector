import type { ProviderActionHandlerSubset, ProviderRuntimeHandler } from "../provider-runtime.ts";
import type { DrataActionContext } from "./runtime-request.ts";

import { drataPathId, drataQuery, drataWorkspacePath, readDrataList, requestDrataJson } from "./runtime-request.ts";

export const drataDirectoryHandlers: ProviderActionHandlerSubset<
  "drata",
  ProviderRuntimeHandler<DrataActionContext>
> = {
  list_roles(input, context) {
    return readDrataList(context, "/roles", input, []);
  },
  get_role(input, context) {
    return requestDrataJson({
      ...context,
      path: `/roles/${drataPathId(input.roleId, "roleId")}`,
      query: drataQuery(input, ["expand"]),
      mode: "execute",
    });
  },
  list_users(input, context) {
    return readDrataList(
      context,
      input.roleId === undefined ? "/users" : `/roles/${drataPathId(input.roleId, "roleId")}/users`,
      input,
      [],
    );
  },
  get_user(input, context) {
    return requestDrataJson({
      ...context,
      path: `/users/${drataPathId(input.userId, "userId")}`,
      query: drataQuery(input, ["expand"]),
      mode: "execute",
    });
  },
  list_control_library(input, context) {
    return readDrataList(context, "/control-library", input, [
      "search",
      "codes",
      "ids",
      "excludeIds",
      "domain",
      "category",
      "frameworkTag",
      "hasTests",
      "hasPolicies",
      "hasEvidence",
      "hasRisks",
    ]);
  },
  get_control_library_item(input, context) {
    return requestDrataJson({
      ...context,
      path: `/control-library/${drataPathId(input.templateId, "templateId")}`,
      query: drataQuery(input, ["expand"]),
      mode: "execute",
    });
  },
  list_risk_library(input, context) {
    return readDrataList(
      context,
      `/risk-registers/${drataPathId(input.riskRegisterId, "riskRegisterId")}/risk-library`,
      input,
      ["riskId", "title", "description"],
    );
  },
  get_risk_library_item(input, context) {
    return requestDrataJson({
      ...context,
      path: `/risk-registers/${drataPathId(input.riskRegisterId, "riskRegisterId")}/risk-library/${drataPathId(input.riskLibraryId, "riskLibraryId")}`,
      query: drataQuery(input, ["expand"]),
      mode: "execute",
    });
  },
  get_control_requirement_comparison(input, context) {
    return requestDrataJson({
      ...context,
      path: `${drataWorkspacePath(input)}/controls-requirement-comparison`,
      query: drataQuery(input, ["controlIds"]),
      mode: "execute",
    });
  },
  get_device(input, context) {
    return requestDrataJson({
      ...context,
      path: `/devices/${drataPathId(input.deviceId, "deviceId")}`,
      query: drataQuery(input, ["expand"]),
      mode: "execute",
    });
  },
  list_device_apps(input, context) {
    return readDrataList(context, `/devices/${drataPathId(input.deviceId, "deviceId")}/apps`, input, []);
  },
  list_connection_devices(input, context) {
    return readDrataList(context, `/connections/${drataPathId(input.connectionId, "connectionId")}/devices`, input, [
      "externalId",
      "macAddress",
      "serialNumber",
      "personnelId",
    ]);
  },
  list_devices_v2(input, context) {
    return readDrataList(context, "/devices", input, [
      "externalId",
      "macAddress",
      "serialNumber",
      "personnelId",
      "connectionId",
      "sourceType",
    ]);
  },
};
