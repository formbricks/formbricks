import { describe, expect, test } from "vitest";
import { SURVEY_IMPORT_MAX_FILE_BYTES } from "@/modules/survey/import/limits";
import { checkSurveyImportFile, getSurveyImportFileExtensions } from "./import-file";

const withAI = { isAIAvailable: true };
const withoutAI = { isAIAvailable: false };

describe("checkSurveyImportFile", () => {
  test.each([
    ["survey.docx", 10, "file_wrong_extension"],
    ["survey.qsf.txt", 10, "file_wrong_extension"],
    ["survey.qsf", 0, "file_empty"],
    ["survey.formbricks.json", 0, "file_empty"],
    ["survey.qsf", SURVEY_IMPORT_MAX_FILE_BYTES + 1, "file_too_large"],
    ["survey.json", SURVEY_IMPORT_MAX_FILE_BYTES + 1, "file_too_large"],
  ])("refuses %s of %i bytes as %s", (name, size, error) => {
    expect(checkSurveyImportFile({ name, size }, withAI)).toBe(error);
  });

  test("accepts a Formbricks file and a .qsf in any case, up to the size cap", () => {
    for (const name of ["Survey.QSF", "Onboarding NPS.formbricks.json", "edited.JSON"]) {
      expect(checkSurveyImportFile({ name, size: SURVEY_IMPORT_MAX_FILE_BYTES }, withAI)).toBeNull();
    }
  });

  test("without Formbricks AI, takes a Formbricks file and refuses a .qsf as needing AI", () => {
    expect(checkSurveyImportFile({ name: "survey.formbricks.json", size: 10 }, withoutAI)).toBeNull();
    expect(checkSurveyImportFile({ name: "survey.qsf", size: 10 }, withoutAI)).toBe("file_needs_ai");
    expect(checkSurveyImportFile({ name: "survey.docx", size: 10 }, withoutAI)).toBe("file_wrong_extension");
  });
});

describe("getSurveyImportFileExtensions", () => {
  test("offers .json always and .qsf only with Formbricks AI", () => {
    expect(getSurveyImportFileExtensions(true)).toEqual([".json", ".qsf"]);
    expect(getSurveyImportFileExtensions(false)).toEqual([".json"]);
  });
});
