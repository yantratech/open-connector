import type { DrataActionContext } from "./runtime-request.ts";

import { looseArray, optionalRecord, recordOrEmpty } from "../../core/cast.ts";
import { providerInputError, providerResponseError } from "../provider-runtime.ts";
import { drataPathId, drataWorkspacePath, readDrataList, requestDrataJson } from "./runtime-request.ts";

/** Resolve the monitor/test namespaces before reading a test or its failures. */
export async function readMonitoringTest(
  input: Record<string, unknown>,
  context: DrataActionContext,
  failures: boolean,
): Promise<unknown> {
  if ((input.testId === undefined) === (input.monitorId === undefined))
    throw providerInputError("Provide exactly one of testId or monitorId. These ID namespaces are distinct.");
  const path = `${drataWorkspacePath(input)}/monitoring-tests`;
  const directory = await readDrataList(context, path, { fetchAll: true, maxResults: 10000 });
  if (optionalRecord(directory.pagination)?.cursor)
    throw providerResponseError("The monitoring test directory exceeded its record budget.");
  const tests = looseArray(directory.data).map(recordOrEmpty);
  const match = tests.find(
    (test) => String(input.monitorId !== undefined ? test.id : test.testId) === String(input.monitorId ?? input.testId),
  );
  if (!match || match.testId === undefined)
    throw providerInputError(
      "No monitoring test matches the selected ID in this workspace. Use testId from list_monitoring_tests_v2 or monitorId from list_monitors.",
    );
  const itemPath = `${path}/${drataPathId(match.testId, "testId")}`;
  const collision =
    input.testId !== undefined && tests.some((test) => test !== match && String(test.id) === String(input.testId));
  if (!failures) {
    const result = await requestDrataJson({ ...context, path: itemPath, mode: "execute" });
    return {
      ...recordOrEmpty(result),
      resolvedTestId: match.testId,
      monitorId: match.id,
      ambiguityNote: collision
        ? "This number is also another test's monitor ID. This response uses the explicitly selected testId namespace."
        : undefined,
    };
  }
  const page = await readDrataList(context, `${itemPath}/failures`, input);
  return {
    ...page,
    testId: match.testId,
    monitorId: match.id,
    testName: match.name,
    checkResultStatus: match.checkResultStatus,
  };
}
