import { describe, expect, test } from "vitest";
import { SURVEY_IMPORT_MAX_FILE_BYTES } from "@/modules/survey/import/limits";
import { checkSurveyImportFile, getSurveyImportFileExtensions, needsExcelExportCheck } from "./import-file";

const withAI = { isAIAvailable: true };
const withoutAI = { isAIAvailable: false };

describe("checkSurveyImportFile", () => {
  test.each([
    ["survey.doc", 10, "file_wrong_extension"],
    ["survey.qsf.txt", 10, "file_wrong_extension"],
    ["survey.qsf", 0, "file_empty"],
    ["survey.formbricks.json", 0, "file_empty"],
    ["survey.qsf", SURVEY_IMPORT_MAX_FILE_BYTES + 1, "file_too_large"],
    ["survey.json", SURVEY_IMPORT_MAX_FILE_BYTES + 1, "file_too_large"],
  ])("refuses %s of %i bytes as %s", (name, size, error) => {
    expect(checkSurveyImportFile({ name, size }, withAI)).toBe(error);
  });

  test("accepts a Formbricks file, a .qsf and a Word, Excel, CSV or Markdown questionnaire in any case, up to the size cap", () => {
    for (const name of [
      "Survey.QSF",
      "Onboarding NPS.formbricks.json",
      "edited.JSON",
      "List.XLSX",
      "list.csv",
      "Questionnaire.DOCX",
      "Questions.MD",
    ]) {
      expect(checkSurveyImportFile({ name, size: SURVEY_IMPORT_MAX_FILE_BYTES }, withAI)).toBeNull();
    }
  });

  test("without Formbricks AI, takes a Formbricks file and an Excel file, and refuses a file only AI reads as needing it", () => {
    expect(checkSurveyImportFile({ name: "survey.formbricks.json", size: 10 }, withoutAI)).toBeNull();
    // It may be a survey's Excel export, which needs no AI: the server tells (ENG-6809).
    expect(checkSurveyImportFile({ name: "Survey.XLSX", size: 10 }, withoutAI)).toBeNull();
    for (const name of ["survey.qsf", "list.csv", "questionnaire.docx", "questions.md"]) {
      expect(checkSurveyImportFile({ name, size: 10 }, withoutAI)).toBe("file_needs_ai");
    }
    expect(checkSurveyImportFile({ name: "survey.doc", size: 10 }, withoutAI)).toBe("file_wrong_extension");
  });
});

describe("getSurveyImportFileExtensions", () => {
  test("offers .json and .xlsx always, and the other files Formbricks AI reads only with it", () => {
    expect(getSurveyImportFileExtensions(true)).toEqual([".json", ".qsf", ".docx", ".xlsx", ".csv", ".md"]);
    expect(getSurveyImportFileExtensions(false)).toEqual([".json", ".xlsx"]);
  });
});

describe("needsExcelExportCheck", () => {
  test("reads an Excel file first only without Formbricks AI", () => {
    expect(needsExcelExportCheck({ name: "Survey.XLSX" }, withoutAI)).toBe(true);
    expect(needsExcelExportCheck({ name: "Survey.xlsx" }, withAI)).toBe(false);
    expect(needsExcelExportCheck({ name: "survey.formbricks.json" }, withoutAI)).toBe(false);
  });
});
