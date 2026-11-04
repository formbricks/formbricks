import { describe, expect, test } from "vitest";
import { ZSurveyImportStreamForm, getSurveyImportFileName } from "./schemas";

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

  test.each(["", "   ", "\u202e\u200f\u0000", "x".repeat(256)])("refuses the file name %j", (name) => {
    expect(ZSurveyImportStreamForm.safeParse({ workspaceId, file: file(name) }).success).toBe(false);
  });

  test("measures the name the report shows, so marks the cleaning drops do not count", () => {
    expect(
      ZSurveyImportStreamForm.safeParse({ workspaceId, file: file(`${"x".repeat(255)}\u202e`) }).success
    ).toBe(true);
  });

  test("refuses a name too long to be worth cleaning, however little of it would show", () => {
    const rlo = String.fromCodePoint(0x202e);
    const named = (name: string) =>
      ZSurveyImportStreamForm.safeParse({ workspaceId, file: file(name) }).success;

    expect(named(`a${rlo.repeat(1020)}`)).toBe(false);
    expect(named(`a${rlo.repeat(1019)}`)).toBe(true);
  });
});

describe("getSurveyImportFileName", () => {
  test("drops what makes a name read as another, and keeps the rest as typed", () => {
    expect(getSurveyImportFileName(file("invoice\u202Egpj.exe"))).toBe("invoicegpj.exe");
    expect(getSurveyImportFileName(file(' Q3: "Pulse" survey?.qsf '))).toBe('Q3: "Pulse" survey?.qsf');
  });
});
