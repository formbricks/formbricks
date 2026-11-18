import { describe, expect, test } from "vitest";
import type { TSurveyElement } from "@formbricks/types/surveys/elements";
import { getNotShownElementIds } from "@formbricks/types/surveys/not-shown";
import {
  surveyFlowFixture,
  surveyFlowFixtureNotShown,
} from "@formbricks/types/surveys/test-fixtures/survey-flow-fixture";
import { getElementsFromBlocks } from "@/modules/survey/lib/client-utils";
import { getResponseCardRows, hasEndedBeforeFirstQuestion } from "./card-rows";

const element = (id: string, type = "openText") => ({ id, type }) as TSurveyElement;
const elements = ["q1", "q2", "q3", "q4", "q5"].map((id) => element(id));
const none = new Set<string>();

describe("getResponseCardRows", () => {
  test("a finished response lists each run of unanswered questions once, on its first question", () => {
    const rows = getResponseCardRows({
      elements,
      data: { q1: "a", q4: "d" },
      finished: true,
      notShownElementIds: none,
    });

    expect(rows).toEqual([
      { type: "answer" },
      { type: "skipped", elementIds: ["q2", "q3"] },
      { type: "skipped", elementIds: undefined },
      { type: "answer" },
      { type: "skipped", elementIds: ["q5"] },
    ]);
  });

  test("an unfinished response marks where it stopped as aborted", () => {
    const rows = getResponseCardRows({
      elements,
      data: { q1: "a", q3: "c" },
      finished: false,
      notShownElementIds: none,
    });

    expect(rows).toEqual([
      { type: "answer" },
      { type: "skipped", elementIds: ["q2"] },
      { type: "answer" },
      { type: "aborted", elementIds: ["q4", "q5"] },
      { type: "aborted", elementIds: undefined },
    ]);
  });

  test("questions the record lists show Not shown, once per run, and never as skipped", () => {
    const rows = getResponseCardRows({
      elements,
      data: { q1: "a", q5: "e" },
      finished: true,
      notShownElementIds: new Set(["q3", "q4"]),
    });

    expect(rows).toEqual([
      { type: "answer" },
      { type: "skipped", elementIds: ["q2"] },
      { type: "notShown", elementIds: ["q3", "q4"] },
      { type: "notShown", elementIds: undefined },
      { type: "answer" },
    ]);
  });

  test("a stopped response whose last blocks were passed over is aborted only where it stopped", () => {
    const rows = getResponseCardRows({
      elements,
      data: { q1: "a", q2: "b" },
      finished: false,
      notShownElementIds: new Set(["q3"]),
    });

    expect(rows.map((row) => row.type)).toEqual(["answer", "answer", "notShown", "aborted", "aborted"]);
  });

  test("the fixture's record marks the Heavy users question and the Apple TV+ follow-up", () => {
    const fixtureElements = getElementsFromBlocks(surveyFlowFixture.blocks);
    const rows = getResponseCardRows({
      elements: fixtureElements,
      data: { services: ["Netflix"], fav: "Netflix" },
      finished: true,
      notShownElementIds: getNotShownElementIds(surveyFlowFixtureNotShown, surveyFlowFixture.blocks),
    });

    const notShown = fixtureElements.filter((_, index) => rows[index].type === "notShown");
    expect(notShown.map(({ id }) => id)).toEqual(["hours", "apple_reason"]);
  });
});

describe("hasEndedBeforeFirstQuestion (ENG-7030)", () => {
  test("a screen-out (finished, no answers, no question times) ended before the first question", () => {
    expect(
      hasEndedBeforeFirstQuestion({ elements, data: { panel_source: "x" }, ttc: {}, finished: true })
    ).toBe(true);
    expect(hasEndedBeforeFirstQuestion({ elements, data: {}, ttc: undefined, finished: true })).toBe(true);
  });

  test("a respondent who skipped every question still left a time for them, so reached the first one", () => {
    expect(
      hasEndedBeforeFirstQuestion({ elements, data: {}, ttc: { q1: 1200, q2: 800 }, finished: true })
    ).toBe(false);
  });

  test("a time of 0 (a prefilled page that submitted itself) still means the question was reached", () => {
    expect(hasEndedBeforeFirstQuestion({ elements, data: {}, ttc: { q1: 0 }, finished: true })).toBe(false);
  });

  test("a time under a question id the survey no longer has still means a question was reached", () => {
    expect(
      hasEndedBeforeFirstQuestion({ elements, data: {}, ttc: { deletedQuestion: 900 }, finished: true })
    ).toBe(false);
  });

  test("a survey without questions never counts a response as ended before the first question", () => {
    expect(hasEndedBeforeFirstQuestion({ elements: [], data: {}, ttc: {}, finished: true })).toBe(false);
  });

  test("an answered question means the first question was reached", () => {
    expect(hasEndedBeforeFirstQuestion({ elements, data: { q3: "c" }, ttc: {}, finished: true })).toBe(false);
  });

  test("a respondent who clicked the welcome card saw it, even when every block was then hidden", () => {
    expect(
      hasEndedBeforeFirstQuestion({ elements, data: { welcomeCard: "clicked" }, ttc: {}, finished: true })
    ).toBe(false);
  });

  test("an unfinished response never counts as ended before the first question", () => {
    expect(hasEndedBeforeFirstQuestion({ elements, data: {}, ttc: {}, finished: false })).toBe(false);
  });

  test("a time recorded only for something other than a question (e.g. _total) is ignored", () => {
    expect(hasEndedBeforeFirstQuestion({ elements, data: {}, ttc: { _total: 300 }, finished: true })).toBe(
      true
    );
  });
});

describe("getResponseCardRows for a response that ended before the first question (ENG-7030)", () => {
  test("lists every question once as not reached, not as skipped", () => {
    const rows = getResponseCardRows({
      elements,
      data: {},
      finished: true,
      notShownElementIds: none,
      endedBeforeFirstQuestion: true,
    });

    expect(rows).toEqual([
      { type: "notReached", elementIds: ["q1", "q2", "q3", "q4", "q5"] },
      { type: "notReached", elementIds: undefined },
      { type: "notReached", elementIds: undefined },
      { type: "notReached", elementIds: undefined },
      { type: "notReached", elementIds: undefined },
    ]);
  });

  test("keeps not-shown questions as not shown (every block passed over by show-if)", () => {
    const rows = getResponseCardRows({
      elements,
      data: {},
      finished: true,
      notShownElementIds: new Set(["q1", "q2", "q3", "q4", "q5"]),
      endedBeforeFirstQuestion: true,
    });

    expect(rows[0]).toEqual({ type: "notShown", elementIds: ["q1", "q2", "q3", "q4", "q5"] });
    expect(rows.slice(1).every((row) => row.type === "notShown")).toBe(true);
  });
});
