import { describe, expect, test } from "vitest";
import { toolResult, toolResultText } from "./__fixtures__/tool-result";
import { isRecord, redactToolResultData, redactUnlessCallerHolds } from "./redacted-result";

const hideSecret = (entry: unknown) =>
  isRecord(entry) && "secret" in entry ? { ...entry, secret: null } : entry;

describe("redactToolResultData", () => {
  test("redacts a single resource and each item of a list, and rewrites the text to match", () => {
    const single = redactToolResultData(
      toolResult({ data: { id: "a", secret: "s" }, requestId: "r" }),
      hideSecret
    );
    expect(single.structuredContent).toEqual({ data: { id: "a", secret: null }, requestId: "r" });
    expect(toolResultText(single)).toEqual(single.structuredContent);

    const list = redactToolResultData(
      toolResult({ data: [{ id: "a", secret: "s" }, { id: "b" }], requestId: "r" }),
      hideSecret
    );
    expect(list.structuredContent).toEqual({
      data: [{ id: "a", secret: null }, { id: "b" }],
      requestId: "r",
    });
  });

  test("hands back the same result when nothing changed, when there is no data, and for an error", () => {
    const clean = toolResult({ data: [{ id: "b" }], requestId: "r" });
    expect(redactToolResultData(clean, hideSecret)).toBe(clean);
    const noData = toolResult({ requestId: "r" });
    expect(redactToolResultData(noData, hideSecret)).toBe(noData);
    const error = { ...toolResult({ data: { secret: "s" } }), isError: true };
    expect(redactToolResultData(error, hideSecret)).toBe(error);
  });
});

describe("redactUnlessCallerHolds", () => {
  const oauth = (permissions: Record<string, string>) => ({
    token: "t",
    clientId: "c",
    scopes: ["responses:read"],
    extra: { authMethod: "oauth", grant: { access: "all", permissions } },
  });
  const result = toolResult({ data: { secret: "s" } });
  const requirements = [{ permission: "responses", level: "read" }] as const;

  test("keeps the result for a caller holding every requirement, and redacts it for one who doesn't", () => {
    expect(redactUnlessCallerHolds(oauth({ responses: "read" }), requirements, result, hideSecret)).toBe(
      result
    );
    expect(redactUnlessCallerHolds(oauth({}), requirements, result, hideSecret).structuredContent).toEqual({
      data: { secret: null },
    });
  });
});
