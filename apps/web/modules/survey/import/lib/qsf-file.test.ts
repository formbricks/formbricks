import { describe, expect, test } from "vitest";
import { SURVEY_IMPORT_MAX_FILE_BYTES } from "@/modules/survey/import/limits";
import { checkQsfFile } from "./qsf-file";

describe("checkQsfFile", () => {
  test.each([
    ["survey.json", 10, "file_wrong_extension"],
    ["survey.qsf.txt", 10, "file_wrong_extension"],
    ["survey.qsf", 0, "file_empty"],
    ["survey.qsf", SURVEY_IMPORT_MAX_FILE_BYTES + 1, "file_too_large"],
  ])("refuses %s of %i bytes as %s", (name, size, error) => {
    expect(checkQsfFile({ name, size })).toBe(error);
  });

  test("accepts a .qsf in any case, up to the size cap", () => {
    expect(checkQsfFile({ name: "Survey.QSF", size: SURVEY_IMPORT_MAX_FILE_BYTES })).toBeNull();
  });
});
