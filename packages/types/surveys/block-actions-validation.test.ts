import { describe, expect, test } from "vitest";
import type { TSurveyBlockLogicAction } from "./blocks";
import { SURVEY_FLOW_FIXTURE_IDS, surveyFlowFixture } from "./test-fixtures/survey-flow-fixture";
import { type TSurvey, ZSurvey } from "./types";

/**
 * The checks every block rule's actions get on save (`validateBlockActions`): each refusal, at the
 * rule's path. Built on the shared fixture, with one rule on the Concept block (block 4).
 */

const ids = SURVEY_FLOW_FIXTURE_IDS;
const CONCEPT = 3;
const rulePath = ["blocks", CONCEPT, "logic", 0];

/** The fixture with the Concept block's rules replaced by one always-running rule. */
const withConceptActions = (
  actions: TSurveyBlockLogicAction[],
  update: (survey: TSurvey) => void = () => undefined
): TSurvey => {
  const survey = structuredClone(surveyFlowFixture);
  survey.blocks[CONCEPT].logic = [
    {
      id: "blockrule000000000000001",
      conditions: { id: "blockgroup00000000000001", connector: "and", conditions: [] },
      actions,
    },
  ];
  update(survey);
  return survey;
};

const issuesOf = (survey: TSurvey) =>
  (ZSurvey.safeParse(survey).error?.issues ?? []).map(({ path, message }) => ({ path, message }));

const expectIssue = (survey: TSurvey, path: PropertyKey[], message: string) => {
  expect(issuesOf(survey)).toContainEqual({ path, message: expect.stringContaining(message) as string });
};

const calculate = (
  variableId: string,
  operator: string,
  value: { type: string; value: string | number }
): TSurveyBlockLogicAction =>
  ({
    id: "blockaction0000000000001",
    objective: "calculate",
    variableId,
    operator,
    value,
  }) as TSurveyBlockLogicAction;

const requireAnswer = (target: string): TSurveyBlockLogicAction => ({
  id: "blockaction0000000000001",
  objective: "requireAnswer",
  target,
});

const jump = (target: string, id = "blockaction0000000000001"): TSurveyBlockLogicAction => ({
  id,
  objective: "jumpToBlock",
  target,
});

describe("block rule actions", () => {
  test("the rule used here is valid with a jump to an ending", () => {
    expect(issuesOf(withConceptActions([jump(ids.endings.thanks)]))).toEqual([]);
  });

  describe("Set value with a one-step operator", () => {
    test("refuses a computed field the survey doesn't have", () => {
      expectIssue(
        withConceptActions([calculate("missing", "assign", { type: "static", value: 1 })]),
        rulePath,
        "Variable ID missing does not exist in logic no: 1 of block 4"
      );
    });

    test("refuses a one-step operator on a computed date", () => {
      expectIssue(
        withConceptActions([calculate(ids.variables.signedUpAt, "assign", { type: "static", value: "x" })]),
        [...rulePath, "actions", 0, "value"],
        "A date field is set with a formula"
      );
    });

    test("refuses a computed field of the other type as the value", () => {
      expectIssue(
        withConceptActions([
          calculate(ids.variables.score, "add", { type: "variable", value: ids.variables.segment }),
        ]),
        rulePath,
        "Invalid variable type for variable"
      );
    });

    test("refuses an answer a text field can't take", () => {
      expectIssue(
        withConceptActions([
          calculate(ids.variables.segment, "assign", { type: "element", value: "services" }),
        ]),
        rulePath,
        "Invalid element type for text variable"
      );
    });

    test("refuses a text answer, or a missing one, for a number field", () => {
      expectIssue(
        withConceptActions([
          calculate(ids.variables.score, "add", { type: "element", value: "apple_reason" }),
        ]),
        rulePath,
        "Invalid element type for number variable"
      );
      expectIssue(
        withConceptActions([calculate(ids.variables.score, "add", { type: "element", value: "gone" })]),
        rulePath,
        "Invalid element type for number variable"
      );
    });
  });

  describe("Require answer", () => {
    test("refuses a question that doesn't exist", () => {
      expectIssue(withConceptActions([requireAnswer("gone")]), rulePath, "Element ID gone does not exist");
    });

    test("refuses a question in the rule's own block", () => {
      expectIssue(withConceptActions([requireAnswer("concept")]), rulePath, "cannot be in the current block");
    });

    test("refuses a question in an earlier block", () => {
      expectIssue(withConceptActions([requireAnswer("hours")]), rulePath, "is in a previous block");
    });

    test("refuses a question that is already required", () => {
      const survey = withConceptActions([requireAnswer("csat")], (draft) => {
        const csat = draft.blocks[5].elements.find((element) => element.id === "csat");
        if (csat) csat.required = true;
      });

      expectIssue(survey, rulePath, "is already required");
    });
  });

  describe("Jump", () => {
    test("refuses a destination that no longer exists", () => {
      expectIssue(withConceptActions([jump("gone")]), rulePath, "Jump destination in rule 1");
    });

    test("refuses a jump to the rule's own block", () => {
      expectIssue(
        withConceptActions([jump(ids.blocks.concept)]),
        rulePath,
        "Cannot jump to the current block"
      );
    });

    test("refuses two jumps in one rule", () => {
      expectIssue(
        withConceptActions([
          jump(ids.endings.thanks),
          jump(ids.endings.noBundle, "blockaction0000000000002"),
        ]),
        ["blocks", CONCEPT, "logic"],
        "Multiple jump actions are not allowed"
      );
    });
  });
});
