import type { ProviderActionHandlerSubset, ProviderRuntimeHandler } from "../provider-runtime.ts";
import type { DrataActionContext } from "./runtime-request.ts";

import { optionalRecord, optionalString } from "../../core/cast.ts";
import { requiredInputString } from "../provider-runtime.ts";
import { filterDrataEvents } from "./runtime-events.ts";
import { readDrataLegacyList } from "./runtime-legacy.ts";
import { readMonitoringTest } from "./runtime-monitoring.ts";
import { drataPersonnelHandlers } from "./runtime-personnel.ts";
import { drataWorkspacePath, readDrataList } from "./runtime-request.ts";
export const drataPeopleHandlers: ProviderActionHandlerSubset<"drata", ProviderRuntimeHandler<DrataActionContext>> = {
  list_personnel_v2: drataPersonnelHandlers.list_personnel_v2,
  update_personnel: drataPersonnelHandlers.update_personnel,
  create_background_check: drataPersonnelHandlers.create_background_check,
  list_personnel_devices: drataPersonnelHandlers.list_personnel_devices,
  list_monitoring_tests_v2(input, context) {
    return readDrataList(context, `${drataWorkspacePath(input)}/monitoring-tests`, input, []);
  },
  list_monitoring_test_failures(input, context) {
    return readMonitoringTest(input, context, true);
  },
  async list_events_v2(input, context) {
    const page = await readDrataList(
      context,
      "/events",
      { ...input, sort: input.sort ?? "createdAt", sortDir: input.sortDir ?? "DESC" },
      ["type", "category", "createdAtFrom"],
    );
    return filterDrataEvents(page, input.createdAtFrom);
  },
  get_recent_events(input, context) {
    return readDrataLegacyList(context, "/events", { limit: input.limit ?? 20, sort: "CREATED", sortDir: "DESC" });
  },
  list_connections(input, context) {
    return readDrataLegacyList(context, "/connections", input);
  },
  async search_vendors(input, context) {
    const result = await readDrataLegacyList(context, "/vendors", { ...input, fetchAll: true });
    const query = requiredInputString(input.query, "query").toLowerCase();
    const data = result.data.filter((value) =>
      optionalString(optionalRecord(value)?.name)?.toLowerCase().includes(query),
    );
    return { ...result, data, returned: data.length };
  },
};
