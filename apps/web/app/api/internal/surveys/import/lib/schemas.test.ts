import { describe, expect, test } from "vitest";
import { ZQsfImportStreamBody } from "./schemas";

const workspaceId = "clxx1234567890123456789012";
const qsf = { SurveyEntry: { SurveyName: "Onboarding" }, SurveyElements: [] };

describe("ZQsfImportStreamBody", () => {
  test("accepts a workspace, a file name and the parsed file", () => {
    expect(ZQsfImportStreamBody.safeParse({ workspaceId, fileName: "onboarding.qsf", qsf }).success).toBe(
      true
    );
  });

  test("rejects unknown top-level keys", () => {
    const result = ZQsfImportStreamBody.safeParse({ workspaceId, fileName: "a.qsf", qsf, extra: true });

    expect(result.success).toBe(false);
  });

  test.each([
    ["a string", JSON.stringify(qsf)],
    ["an array", [qsf]],
    ["null", null],
  ])("rejects qsf sent as %s", (_case, value) => {
    expect(ZQsfImportStreamBody.safeParse({ workspaceId, fileName: "a.qsf", qsf: value }).success).toBe(
      false
    );
  });

  test.each(["", "   ", "x".repeat(256)])("rejects the file name %j", (fileName) => {
    expect(ZQsfImportStreamBody.safeParse({ workspaceId, fileName, qsf }).success).toBe(false);
  });

  test("hands the parsed file through without copying it", () => {
    const body = { workspaceId, fileName: "a.qsf", qsf };

    const result = ZQsfImportStreamBody.parse(body);

    expect(result.qsf).toBe(qsf);
  });

  test("a __proto__ key in the file pollutes nothing", () => {
    // What the wrapper hands the schema: JSON.parse output, where __proto__ is an own data key.
    const body = JSON.parse(
      `{"workspaceId":"${workspaceId}","fileName":"a.qsf","qsf":{"__proto__":{"polluted":true},"SurveyElements":[]}}`
    );

    ZQsfImportStreamBody.parse(body);

    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });
});
