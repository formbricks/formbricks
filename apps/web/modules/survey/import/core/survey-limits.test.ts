import { describe, expect, test } from "vitest";
import {
  SURVEY_IMPORT_MAX_DRAFT_BYTES,
  SURVEY_IMPORT_MAX_OPTIONS_PER_QUESTION,
  SURVEY_IMPORT_MAX_TEXT_CHARS,
} from "../limits";
import { SurveyImportFileTooLargeError } from "./errors";
import { assertSurveyWithinDraftSize, findSurveyContentPastLimits } from "./survey-limits";

const surveyWith = (element: Record<string, unknown>) => ({
  name: "S",
  blocks: [{ id: "b1", name: "Block 1", elements: [{ id: "q1", type: "openText", ...element }] }],
});

const options = (count: number) => Array.from({ length: count }, (_, index) => ({ id: `o${index}` }));

describe("findSurveyContentPastLimits", () => {
  test(`takes ${SURVEY_IMPORT_MAX_TEXT_CHARS} characters in a text and refuses one more, naming it`, () => {
    const at = (length: number) => surveyWith({ headline: { "en-US": "x".repeat(length) } });
    expect(findSurveyContentPastLimits(at(SURVEY_IMPORT_MAX_TEXT_CHARS), null)).toEqual([]);
    expect(findSurveyContentPastLimits(at(SURVEY_IMPORT_MAX_TEXT_CHARS + 1), "file")).toEqual([
      expect.objectContaining({
        name: "file.survey.blocks.0.elements.0.headline.en-US",
        code: "limit_exceeded",
      }),
    ]);
  });

  test.each(["choices", "rows", "columns"])(
    `takes ${SURVEY_IMPORT_MAX_OPTIONS_PER_QUESTION} %s on a question and refuses one more, naming the list`,
    (list) => {
      expect(
        findSurveyContentPastLimits(
          surveyWith({ [list]: options(SURVEY_IMPORT_MAX_OPTIONS_PER_QUESTION) }),
          null
        )
      ).toEqual([]);
      expect(
        findSurveyContentPastLimits(
          surveyWith({ [list]: options(SURVEY_IMPORT_MAX_OPTIONS_PER_QUESTION + 1) }),
          null
        )
      ).toEqual([
        expect.objectContaining({ name: `survey.blocks.0.elements.0.${list}`, code: "limit_exceeded" }),
      ]);
    }
  );

  test("finds a long text anywhere in the survey, not only in its questions", () => {
    expect(findSurveyContentPastLimits({ name: "x".repeat(SURVEY_IMPORT_MAX_TEXT_CHARS + 1) }, null)).toEqual(
      [expect.objectContaining({ name: "survey.name" })]
    );
  });
});

describe("assertSurveyWithinDraftSize", () => {
  /** A survey whose JSON is exactly `bytes` long. */
  const ofBytes = (bytes: number) => {
    const empty = JSON.stringify({ name: "" }).length;
    return { name: "x".repeat(bytes - empty) };
  };

  test(`takes a survey of ${SURVEY_IMPORT_MAX_DRAFT_BYTES} bytes and refuses one byte more with a 413 naming it`, () => {
    expect(() => assertSurveyWithinDraftSize(ofBytes(SURVEY_IMPORT_MAX_DRAFT_BYTES), null)).not.toThrow();
    try {
      assertSurveyWithinDraftSize(ofBytes(SURVEY_IMPORT_MAX_DRAFT_BYTES + 1), "file");
      expect.unreachable("expected a refusal");
    } catch (error) {
      expect(error).toBeInstanceOf(SurveyImportFileTooLargeError);
      expect((error as SurveyImportFileTooLargeError).invalidParams).toEqual([
        expect.objectContaining({ name: "file.survey", identifier: "survey_size" }),
      ]);
    }
  });
});
