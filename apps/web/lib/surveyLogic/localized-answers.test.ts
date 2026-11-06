import { describe, expect, test } from "vitest";
import {
  answeredInGerman,
  editorRatedGood,
  multilingualSurvey,
  pickedPro,
  rankedSpeed,
} from "./test-fixtures/multilingual-answers";
import { evaluateLogic } from "./utils";

/**
 * ENG-6943: answers name options by their label in the language the respondent answered in, and a
 * language switch mid-survey leaves earlier answers in the language they were given in. The server
 * engine (quotas) reads an answer back to its option in the response's language first, then in any
 * language of the survey, as the renderer does.
 */

describe("an answer stored in another language of the survey", () => {
  test("a single select answer reads as its option", () => {
    expect(evaluateLogic(multilingualSurvey, answeredInGerman, {}, pickedPro, "default")).toBe(true);
  });

  test("a ranking answer reads as its options", () => {
    expect(evaluateLogic(multilingualSurvey, answeredInGerman, {}, rankedSpeed, "default")).toBe(true);
  });

  test("a matrix answer reads its row and column", () => {
    expect(evaluateLogic(multilingualSurvey, answeredInGerman, {}, editorRatedGood, "default")).toBe(true);
  });

  test("the response's own language still reads as before", () => {
    const answeredInEnglish = { plan: "Pro", rank: ["Speed"], grid: { Editor: "Good" } };
    expect(evaluateLogic(multilingualSurvey, answeredInEnglish, {}, pickedPro, "default")).toBe(true);
    expect(evaluateLogic(multilingualSurvey, answeredInEnglish, {}, rankedSpeed, "default")).toBe(true);
    expect(evaluateLogic(multilingualSurvey, answeredInEnglish, {}, editorRatedGood, "default")).toBe(true);
  });

  test("a label no language has matches nothing", () => {
    expect(evaluateLogic(multilingualSurvey, { plan: "Gold" }, {}, pickedPro, "default")).toBe(false);
  });
});
