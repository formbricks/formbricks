import { describe, expect, test } from "vitest";
import {
  ANSWER_MEMBER,
  type TAnswerQuestion,
  checkAnswerRule,
  collectAnswerQuestionIds,
  formatAnswerValue,
  parseAnswerValue,
} from "./answer-filter";

const questions = new Map<string, TAnswerQuestion>(
  (
    [
      { id: "q_delivery", label: "Delivery", kind: "choice", options: [] },
      { id: "q_feat", label: "Features", kind: "multi", options: [] },
      { id: "q_nps", label: "NPS", kind: "number", options: [] },
      { id: "q_yn", label: "Buy again?", kind: "boolean", options: [] },
    ] satisfies TAnswerQuestion[]
  ).map((question) => [question.id, question])
);

describe("answer filter values", () => {
  test("round-trips a question id and value key, splitting at the first colon", () => {
    expect(formatAnswerValue("q_delivery", "opt:late")).toBe("q_delivery:opt:late");
    expect(parseAnswerValue("q_delivery:opt:late")).toEqual({
      questionId: "q_delivery",
      valueKey: "opt:late",
    });
  });

  test.each(["", ":x", "x:", "nocolon"])("refuses the malformed value %j", (value) => {
    expect(parseAnswerValue(value)).toBeNull();
  });
});

describe("checkAnswerRule", () => {
  test("accepts every operator a kind offers", () => {
    expect(checkAnswerRule("equals", ["q_delivery:opt_late"], questions)).toBeNull();
    expect(
      checkAnswerRule("notEquals", ["q_delivery:opt_late", "q_delivery:opt_early"], questions)
    ).toBeNull();
    expect(checkAnswerRule("equals", ["q_feat:opt_a", "q_feat:opt_b"], questions)).toBeNull();
    expect(checkAnswerRule("notEquals", ["q_nps:9"], questions)).toBeNull();
    expect(checkAnswerRule("equals", ["q_yn:true"], questions)).toBeNull();
  });

  test("checks only the shape without the dataset's questions", () => {
    expect(checkAnswerRule("notEquals", ["q_anything:x"])).toBeNull();
    expect(checkAnswerRule("equals", ["x"])).toBe("malformed_value");
    expect(checkAnswerRule("equals", ["q_a:1", "q_b:1"])).toBe("several_questions");
  });

  test.each([
    ["an unknown question", "equals", ["q_gone:x"], "unknown_question"],
    ["multi-select 'does not contain'", "notEquals", ["q_feat:opt_a"], "operator_not_allowed"],
    ["a word on a number question", "equals", ["q_nps:high"], "value_not_allowed"],
    ["yes on a yes/no question", "equals", ["q_yn:yes"], "value_not_allowed"],
  ])("refuses %s", (_label, operator, values, problem) => {
    expect(checkAnswerRule(operator, values, questions)).toBe(problem);
  });
});

describe("collectAnswerQuestionIds", () => {
  test("finds every question named through nested groups, once each", () => {
    expect(
      collectAnswerQuestionIds([
        { member: ANSWER_MEMBER, operator: "equals", values: ["q_delivery:opt_late"] },
        {
          or: [
            { member: "FeedbackRecords.fieldId", operator: "equals", values: ["q_nps:x"] },
            { and: [{ member: ANSWER_MEMBER, operator: "equals", values: ["q_feat:a", "q_feat:b"] }] },
            { member: ANSWER_MEMBER, operator: "notEquals", values: ["q_delivery:opt_early"] },
          ],
        },
      ])
    ).toEqual(["q_delivery", "q_feat"]);
  });

  test("answers nothing for no filters, and skips what is not a filter", () => {
    expect(collectAnswerQuestionIds(undefined)).toEqual([]);
    expect(collectAnswerQuestionIds([])).toEqual([]);
    expect(collectAnswerQuestionIds([null, 7, { member: ANSWER_MEMBER, values: [3] }] as never)).toEqual([]);
  });
});
