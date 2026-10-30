import { describe, expect, test } from "vitest";
import { ZSurveyImportStreamForm } from "./schemas";

const workspaceId = "clxx1234567890123456789012";
const file = (name = "onboarding.qsf") => new File(['{"SurveyEntry":{}}'], name);

describe("ZSurveyImportStreamForm", () => {
  test("takes a workspace and exactly one file, and hands the file through as it came", () => {
    const upload = file();

    const result = ZSurveyImportStreamForm.parse({ workspaceId, file: upload });

    expect(result).toEqual({ workspaceId, file: upload });
    expect(result.file).toBe(upload);
  });

  test("refuses fields it does not take, a file name among them: the name comes from the file part", () => {
    expect(ZSurveyImportStreamForm.safeParse({ workspaceId, file: file(), fileName: "a.qsf" }).success).toBe(
      false
    );
  });

  test.each([
    ["no file", { workspaceId }],
    ["text where the file belongs", { workspaceId, file: '{"SurveyEntry":{}}' }],
    ["two files", { workspaceId, file: [file(), file()] }],
    ["a file where the workspace belongs", { workspaceId: file(), file: file() }],
  ])("refuses %s", (_case, fields) => {
    expect(ZSurveyImportStreamForm.safeParse(fields).success).toBe(false);
  });

  test.each(["", "   ", "x".repeat(256)])("refuses the file name %j", (name) => {
    expect(ZSurveyImportStreamForm.safeParse({ workspaceId, file: file(name) }).success).toBe(false);
  });
});
