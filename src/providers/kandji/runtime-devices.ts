import type { ProviderActionHandlerSubset, ProviderRuntimeHandler } from "../provider-runtime.ts";
import type { KandjiActionContext } from "./runtime-request.ts";

import { randomInt } from "node:crypto";
import { compactObject, looseArray, optionalRecord, optionalString } from "../../core/cast.ts";
import { providerInputError, requiredInputString } from "../provider-runtime.ts";
import { kandjiPathSegment, requestKandjiJson } from "./runtime-request.ts";

export const kandjiDeviceHandlers: ProviderActionHandlerSubset<
  "kandji",
  ProviderRuntimeHandler<KandjiActionContext>
> = {
  async get_device_library_items(input, context) {
    const payload = await requestKandjiJson({
      ...context,
      path: `${devicePath(input)}/library-items`,
      phase: "execute",
    });
    return looseArray(optionalRecord(payload)?.library_items);
  },
  async get_device_parameters(input, context) {
    const payload = await requestKandjiJson({ ...context, path: `${devicePath(input)}/parameters`, phase: "execute" });
    return looseArray(optionalRecord(payload)?.parameters);
  },
  async get_device_commands(input, context) {
    const payload = await requestKandjiJson({ ...context, path: `${devicePath(input)}/commands`, phase: "execute" });
    return looseArray(optionalRecord(optionalRecord(payload)?.commands)?.results);
  },
  async list_device_notes(input, context) {
    return looseArray(await requestKandjiJson({ ...context, path: `${devicePath(input)}/notes`, phase: "execute" }));
  },
  get_device_note(input, context) {
    return requestKandjiJson({ ...context, path: notePath(input), phase: "execute" });
  },
  create_device_note(input, context) {
    return requestKandjiJson({
      ...context,
      path: `${devicePath(input)}/notes`,
      method: "POST",
      body: { content: requiredInputString(input.content, "content") },
      phase: "execute",
    });
  },
  update_device_note(input, context) {
    return requestKandjiJson({
      ...context,
      path: notePath(input),
      method: "PATCH",
      body: { content: requiredInputString(input.content, "content") },
      phase: "execute",
    });
  },
  delete_device_note(input, context) {
    return requestKandjiJson({ ...context, path: notePath(input), method: "DELETE", phase: "execute" });
  },
  get_activation_lock_bypass_code(input, context) {
    return readDeviceSecret(input, context, "bypasscode");
  },
  get_filevault_recovery_key(input, context) {
    return readDeviceSecret(input, context, "filevaultkey");
  },
  get_unlock_pin(input, context) {
    return readDeviceSecret(input, context, "unlockpin");
  },
  get_recovery_lock_password(input, context) {
    return readDeviceSecret(input, context, "recoverypassword");
  },
  get_device_lost_mode(input, context) {
    return requestKandjiJson({ ...context, path: `${devicePath(input)}/details/lostmode`, phase: "execute" });
  },
  update_device(input, context) {
    const body = compactObject({
      asset_tag: input.asset_tag,
      blueprint_id: input.blueprint_id,
      user: input.user,
      tags: input.tags,
    });
    if (Object.keys(body).length === 0) throw providerInputError("Provide at least one device field to change.");
    return requestKandjiJson({ ...context, path: devicePath(input), method: "PATCH", body, phase: "execute" });
  },
  update_inventory(input, context) {
    return queueDeviceCommand(input, context, "updateinventory");
  },
  daily_checkin(input, context) {
    return queueDeviceCommand(input, context, "dailycheckin");
  },
  lock_device(input, context) {
    return queueDeviceCommand(input, context, "lock");
  },
  async erase_device(input, context) {
    const PIN = optionalString(input.PIN) ?? String(randomInt(0, 1_000_000)).padStart(6, "0");
    if (!/^[0-9]{6}$/.test(PIN)) throw providerInputError("PIN must contain exactly six digits.");
    const command = await queueDeviceCommand(
      input,
      context,
      "erase",
      compactObject({ PIN, PINMessage: input.pin_message, PhoneNumber: input.phone_number }),
    );
    return { ...command, PIN };
  },
  clear_passcode(input, context) {
    return queueDeviceCommand(input, context, "clearpasscode");
  },
  enable_lost_mode(input, context) {
    return queueDeviceCommand(
      input,
      context,
      "enablelostmode",
      compactObject({ Message: input.message, PhoneNumber: input.phone_number, Footnote: input.footnote }),
    );
  },
  disable_lost_mode(input, context) {
    return queueDeviceCommand(input, context, "disablelostmode");
  },
  play_lost_mode_sound(input, context) {
    return queueDeviceCommand(input, context, "playlostmodesound");
  },
  update_location(input, context) {
    return queueDeviceCommand(input, context, "updatelocation");
  },
  restart_device(input, context) {
    return queueDeviceCommand(input, context, "restart");
  },
  shutdown_device(input, context) {
    return queueDeviceCommand(input, context, "shutdown");
  },
  blank_push(input, context) {
    return queueDeviceCommand(input, context, "blankpush");
  },
  renew_mdm_profile(input, context) {
    return queueDeviceCommand(input, context, "renewmdmprofile");
  },
  reinstall_agent(input, context) {
    return queueDeviceCommand(input, context, "reinstallagent");
  },
  delete_user(input, context) {
    return queueDeviceCommand(input, context, "deleteuser", {
      UserName: requiredInputString(input.user_name, "user_name"),
    });
  },
  unlock_account(input, context) {
    return queueDeviceCommand(input, context, "unlockaccount", {
      UserName: requiredInputString(input.user_name, "user_name"),
    });
  },
};

function devicePath(input: Record<string, unknown>): string {
  return `/api/v1/devices/${kandjiPathSegment(input.deviceId, "deviceId")}`;
}

function notePath(input: Record<string, unknown>): string {
  return `${devicePath(input)}/notes/${kandjiPathSegment(input.noteId, "noteId")}`;
}

function readDeviceSecret(
  input: Record<string, unknown>,
  context: KandjiActionContext,
  kind: string,
): Promise<unknown> {
  return requestKandjiJson({ ...context, path: `${devicePath(input)}/secrets/${kind}`, phase: "execute" });
}

async function queueDeviceCommand(
  input: Record<string, unknown>,
  context: KandjiActionContext,
  action: string,
  body?: Record<string, unknown>,
): Promise<{ queued: boolean; action: string; result: unknown }> {
  const result = await requestKandjiJson({
    ...context,
    path: `${devicePath(input)}/action/${action}`,
    method: "POST",
    body,
    phase: "execute",
  });
  return { queued: true, action, result };
}
