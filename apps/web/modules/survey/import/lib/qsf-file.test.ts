import { describe, expect, test } from "vitest";
import { QSF_IMPORT_MAX_FILE_BYTES, checkQsfFile, readQsfFile } from "./qsf-file";

const qsfFile = (content: string, name = "survey.qsf") => new File([content], name);

describe("checkQsfFile", () => {
  test.each([
    ["survey.json", 10, "qsf_wrong_extension"],
    ["survey.qsf.txt", 10, "qsf_wrong_extension"],
    ["survey.qsf", 0, "qsf_empty"],
    ["survey.qsf", QSF_IMPORT_MAX_FILE_BYTES + 1, "qsf_too_large"],
  ])("refuses %s of %i bytes as %s", (name, size, error) => {
    expect(checkQsfFile({ name, size })).toBe(error);
  });

  test("accepts a .qsf in any case, up to the size cap", () => {
    expect(checkQsfFile({ name: "Survey.QSF", size: QSF_IMPORT_MAX_FILE_BYTES })).toBeNull();
  });
});

describe("readQsfFile", () => {
  test("parses the file into the object the route expects", async () => {
    const result = await readQsfFile(qsfFile('{"SurveyEntry":{"SurveyName":"A"},"SurveyElements":[]}'));

    expect(result).toEqual({
      ok: true,
      fileName: "survey.qsf",
      qsf: { SurveyEntry: { SurveyName: "A" }, SurveyElements: [] },
    });
  });

  test("reads a file that starts with a byte-order mark", async () => {
    const result = await readQsfFile(qsfFile('﻿{"SurveyEntry":{}}'));

    expect(result).toMatchObject({ ok: true, qsf: { SurveyEntry: {} } });
  });

  test.each([
    ["text that is not JSON", "not json", "qsf_not_json"],
    ["a cut-off file", '{"SurveyEntry":{"SurveyName":"A"', "qsf_not_json"],
    ["a JSON array", "[1, 2]", "qsf_not_object"],
    ["a JSON string", '"survey"', "qsf_not_object"],
    ["JSON null", "null", "qsf_not_object"],
  ])("refuses %s before uploading it", async (_case, content, error) => {
    expect(await readQsfFile(qsfFile(content))).toEqual({ ok: false, error });
  });

  test("refuses by name and size before reading the content", async () => {
    expect(await readQsfFile(qsfFile("{}", "survey.json"))).toEqual({
      ok: false,
      error: "qsf_wrong_extension",
    });
  });
});
