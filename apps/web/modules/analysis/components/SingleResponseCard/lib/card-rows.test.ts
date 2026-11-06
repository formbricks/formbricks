import { describe, expect, test } from "vitest";
import { getNotShownElementIds } from "@formbricks/types/surveys/not-shown";
import {
  surveyFlowFixture,
  surveyFlowFixtureNotShown,
} from "@formbricks/types/surveys/test-fixtures/survey-flow-fixture";
import { getElementsFromBlocks } from "@/modules/survey/lib/client-utils";
import { getResponseCardRows } from "./card-rows";

const element = (id: string, type = "openText") => ({ id, type }) as any;
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
