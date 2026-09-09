import type { ProviderActionHandlerSubset, ProviderRuntimeHandler } from "../provider-runtime.ts";
import type { DrataActionContext } from "./runtime-request.ts";

import { drataPathId, readDrataList, requestDrataJson } from "./runtime-request.ts";

export const drataCustomHandlers: ProviderActionHandlerSubset<"drata", ProviderRuntimeHandler<DrataActionContext>> = {
  list_custom_connections(input, context) {
    return readDrataList(context, "/custom-connections", input, []);
  },
  create_custom_connection(input, context) {
    return requestDrataJson({
      ...context,
      path: "/custom-connections",
      method: "POST",
      body: { name: input.name, description: input.description },
      mode: "execute",
    });
  },
  list_custom_data_records(input, context) {
    return readDrataList(
      context,
      `/custom-connections/${drataPathId(input.connectionId, "connectionId")}/resources/${drataPathId(input.resourceId, "resourceId")}/records`,
      input,
      [],
    );
  },
  list_custom_data_records_sessions(input, context) {
    return readDrataList(
      context,
      `/custom-connections/${drataPathId(input.connectionId, "connectionId")}/resources/${drataPathId(input.resourceId, "resourceId")}/sessions`,
      input,
      [],
    );
  },
  push_connection_records(input, context) {
    return requestDrataJson({
      ...context,
      path: `/custom-connections/${drataPathId(input.connectionId, "connectionId")}/resources/${drataPathId(input.resourceId, "resourceId")}/records`,
      method: "POST",
      body: { data: input.data },
      mode: "execute",
    });
  },
  upsert_custom_data_records(input, context) {
    return requestDrataJson({
      ...context,
      path: `/custom-connections/${drataPathId(input.connectionId, "connectionId")}/resources/${drataPathId(input.resourceId, "resourceId")}/records`,
      method: "POST",
      body: { data: input.data },
      mode: "execute",
    });
  },
  upsert_custom_data_records_session(input, context) {
    return requestDrataJson({
      ...context,
      path: `/custom-connections/${drataPathId(input.connectionId, "connectionId")}/resources/${drataPathId(input.resourceId, "resourceId")}/sessions/${drataPathId(input.sessionId, "sessionId")}`,
      method: "POST",
      body: { data: input.data },
      mode: "execute",
    });
  },
  perform_custom_data_session_action(input, context) {
    return requestDrataJson({
      ...context,
      path: `/custom-connections/${drataPathId(input.connectionId, "connectionId")}/resources/${drataPathId(input.resourceId, "resourceId")}/sessions/${drataPathId(input.sessionId, "sessionId")}/actions`,
      method: "POST",
      body: { action: input.action },
      mode: "execute",
    });
  },
  update_custom_data_record(input, context) {
    return requestDrataJson({
      ...context,
      path: `/custom-connections/${drataPathId(input.connectionId, "connectionId")}/resources/${drataPathId(input.resourceId, "resourceId")}/records/${drataPathId(input.recordId, "recordId")}`,
      method: "PUT",
      body: { data: input.data },
      mode: "execute",
    });
  },
  delete_custom_data_record(input, context) {
    return requestDrataJson({
      ...context,
      path: `/custom-connections/${drataPathId(input.connectionId, "connectionId")}/resources/${drataPathId(input.resourceId, "resourceId")}/records/${drataPathId(input.recordId, "recordId")}`,
      method: "DELETE",
      body: undefined,
      mode: "execute",
    });
  },
};
