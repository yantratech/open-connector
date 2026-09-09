import type { ActionDefinition } from "../../core/types.ts";

import { s } from "../../core/json-schema.ts";
import { defineProviderAction } from "../../core/provider-definition.ts";

const deviceId = s.nonEmptyString("The enrolled device ID.");
const noteId = s.nonEmptyString("The device note ID.");
const deviceInput = s.requiredObject("The target device.", { deviceId });
const noteInput = s.requiredObject("The target device note.", { deviceId, noteId });
const objectOutput = s.looseObject("The device resource returned by Kandji.");
const listOutput = s.array("The requested device records.", s.looseObject("A device record."));
const commandOutput = s.looseRequiredObject(
  "The queued device command. Completion depends on the device checking in.",
  {
    queued: s.boolean(),
    action: s.string(),
    result: s.unknown("The command response, if present."),
  },
  { optional: ["result"] },
);

export const kandjiDeviceActions: ActionDefinition[] = [
  {
    name: "get_device_library_items",
    description: "Read the library items assigned to a device.",
    inputSchema: deviceInput,
    outputSchema: listOutput,
  },
  {
    name: "get_device_parameters",
    description: "Read the configuration parameters assigned to a device.",
    inputSchema: deviceInput,
    outputSchema: listOutput,
  },
  {
    name: "get_device_commands",
    description: "Read the MDM commands recorded for a device.",
    inputSchema: deviceInput,
    outputSchema: listOutput,
  },
  {
    name: "list_device_notes",
    description: "Read the administrator notes attached to a device.",
    inputSchema: deviceInput,
    outputSchema: listOutput,
  },
  {
    name: "get_device_note",
    description: "Read one administrator note on a device.",
    inputSchema: noteInput,
    outputSchema: objectOutput,
  },
  {
    name: "create_device_note",
    description: "Add an administrator note to a device.",
    inputSchema: s.requiredObject("The new device note.", { deviceId, content: s.nonEmptyString("The note text.") }),
    outputSchema: objectOutput,
  },
  {
    name: "update_device_note",
    description: "Replace the content of an administrator note.",
    inputSchema: s.requiredObject("The device note changes.", {
      deviceId,
      noteId,
      content: s.nonEmptyString("The replacement note text."),
    }),
    outputSchema: objectOutput,
  },
  {
    name: "delete_device_note",
    description: "Delete an administrator note from a device.",
    inputSchema: noteInput,
    outputSchema: s.unknown("The deletion response, or null when Kandji returns no content."),
  },
  {
    name: "get_activation_lock_bypass_code",
    description: "Read the sensitive Activation Lock bypass code for an authorized device recovery.",
    inputSchema: deviceInput,
    outputSchema: objectOutput,
  },
  {
    name: "get_filevault_recovery_key",
    description: "Read the sensitive FileVault recovery key for an authorized device recovery.",
    inputSchema: deviceInput,
    outputSchema: objectOutput,
  },
  {
    name: "get_unlock_pin",
    description: "Read the sensitive PIN needed to unlock a device locked through MDM.",
    inputSchema: deviceInput,
    outputSchema: objectOutput,
  },
  {
    name: "get_recovery_lock_password",
    description: "Read the sensitive Recovery Lock password for an authorized device recovery.",
    inputSchema: deviceInput,
    outputSchema: objectOutput,
  },
  {
    name: "get_device_lost_mode",
    description: "Read the device's current Lost Mode state.",
    inputSchema: deviceInput,
    outputSchema: objectOutput,
  },
  {
    name: "update_device",
    description:
      "Change device ownership, asset tag, blueprint or tags. Null clears ownership or the asset tag; an empty tags array removes tags.",
    inputSchema: s.object(
      "The device changes.",
      {
        deviceId,
        asset_tag: s.nullableString("The asset tag, or null to clear it."),
        blueprint_id: s.nonEmptyString("The target blueprint ID."),
        user: s.nullableString("The assigned user ID, or null to unassign the device."),
        tags: s.array("The complete replacement set of tag IDs.", s.string()),
      },
      { required: ["deviceId"] },
    ),
    outputSchema: objectOutput,
  },
  {
    name: "update_inventory",
    description: "Request a fresh device inventory from the Kandji agent.",
    inputSchema: deviceInput,
    outputSchema: commandOutput,
  },
  {
    name: "daily_checkin",
    description: "Request a fresh daily check-in from the Kandji agent.",
    inputSchema: deviceInput,
    outputSchema: commandOutput,
  },
  {
    name: "lock_device",
    description: "Lock the device through MDM. This interrupts device use; only run with explicit authorization.",
    inputSchema: deviceInput,
    outputSchema: commandOutput,
  },
  {
    name: "erase_device",
    description:
      "Irreversibly erase all device data through MDM. Only run for an explicitly authorized wipe. Return the final six-digit PIN to the device owner so they can release the firmware lock.",
    inputSchema: s.object(
      "The authorized device wipe.",
      {
        deviceId,
        PIN: s.string("The six-digit firmware PIN; a cryptographically random PIN is generated when omitted.", {
          pattern: "^[0-9]{6}$",
        }),
        pin_message: s.string("The message shown on the firmware lock screen."),
        phone_number: s.string("The contact number shown on the firmware lock screen."),
      },
      { required: ["deviceId"] },
    ),
    outputSchema: s.looseRequiredObject(
      "The queued erase command and final firmware PIN.",
      { queued: s.boolean(), action: s.string(), PIN: s.string(), result: s.unknown("The upstream command response.") },
      { optional: ["result"] },
    ),
  },
  {
    name: "clear_passcode",
    description: "Clear the device passcode through MDM for an authorized recovery.",
    inputSchema: deviceInput,
    outputSchema: commandOutput,
  },
  {
    name: "enable_lost_mode",
    description: "Enable Lost Mode on the device and optionally display recovery contact details.",
    inputSchema: s.object(
      "The Lost Mode request.",
      {
        deviceId,
        message: s.string("The lock-screen message."),
        phone_number: s.string("The recovery contact number."),
        footnote: s.string("The lock-screen footnote."),
      },
      { required: ["deviceId"] },
    ),
    outputSchema: commandOutput,
  },
  {
    name: "disable_lost_mode",
    description: "Disable Lost Mode on a recovered device.",
    inputSchema: deviceInput,
    outputSchema: commandOutput,
  },
  {
    name: "play_lost_mode_sound",
    description: "Play a sound on a device in Lost Mode.",
    inputSchema: deviceInput,
    outputSchema: commandOutput,
  },
  {
    name: "update_location",
    description: "Request a location update for a device in Lost Mode.",
    inputSchema: deviceInput,
    outputSchema: commandOutput,
  },
  {
    name: "restart_device",
    description: "Restart the device through MDM. This interrupts active work and requires explicit authorization.",
    inputSchema: deviceInput,
    outputSchema: commandOutput,
  },
  {
    name: "shutdown_device",
    description: "Shut down the device through MDM. This interrupts active work and requires explicit authorization.",
    inputSchema: deviceInput,
    outputSchema: commandOutput,
  },
  {
    name: "blank_push",
    description: "Send an MDM push to prompt the device to check for pending commands.",
    inputSchema: deviceInput,
    outputSchema: commandOutput,
  },
  {
    name: "renew_mdm_profile",
    description: "Request renewal of the device's MDM profile.",
    inputSchema: deviceInput,
    outputSchema: commandOutput,
  },
  {
    name: "reinstall_agent",
    description: "Request reinstallation of the Kandji agent on a Mac.",
    inputSchema: deviceInput,
    outputSchema: commandOutput,
  },
  {
    name: "delete_user",
    description:
      "Delete a local user and their data from the device. This is destructive and requires explicit authorization.",
    inputSchema: s.requiredObject("The local user to delete.", {
      deviceId,
      user_name: s.nonEmptyString("The local account's short username."),
    }),
    outputSchema: commandOutput,
  },
  {
    name: "unlock_account",
    description: "Unlock a local user account on the device.",
    inputSchema: s.requiredObject("The local account to unlock.", {
      deviceId,
      user_name: s.nonEmptyString("The local account's short username."),
    }),
    outputSchema: commandOutput,
  },
].map((action) => defineProviderAction("kandji", action));
