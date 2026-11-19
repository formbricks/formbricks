import { describe, expect, test } from "vitest";
import type { TSingleCondition } from "./logic";
import { SURVEY_FLOW_FIXTURE_IDS, surveyFlowFixture } from "./test-fixtures/survey-flow-fixture";
import { type TSurvey, ZSurvey } from "./types";

/**
 * The operand checks every block rule's conditions get on save (`validateConditionGroupOperands`):
 * one refusal per case, at the rule's conditions path. Built on the shared fixture, with one rule on
 * the last block (Profile, block 6) so every element it names comes earlier or on the same block.
 */

const ids = SURVEY_FLOW_FIXTURE_IDS;
const PROFILE = 5;
const MISSING_VARIABLE = "zzzzzzzzzzzzzzzzzzzzzzzz";

const withRuleOn = (blockIndex: number, condition: Record<string, unknown>): TSurvey => {
  const survey = structuredClone(surveyFlowFixture);
  survey.blocks[blockIndex].logic = [
    {
      id: "condrule0000000000000001",
      conditions: {
        id: "condgroup000000000000001",
        connector: "and",
        conditions: [{ id: "condsingle00000000000001", ...condition } as TSingleCondition],
      },
      actions: [{ id: "condaction00000000000001", objective: "jumpToBlock", target: ids.endings.thanks }],
    },
  ];
  return survey;
};

/** The messages the operand checks report for one condition on the Profile block's rule. */
const operandIssues = (condition: Record<string, unknown>, blockIndex = PROFILE): string[] =>
  (ZSurvey.safeParse(withRuleOn(blockIndex, condition)).error?.issues ?? [])
    .filter((issue) => issue.path.join(".") === `blocks.${String(blockIndex)}.logic.0.conditions`)
    .map((issue) => issue.message);

const where = "in logic no: 1 of block 6";
const element = (value: string, meta?: Record<string, string>) => ({ type: "element", value, meta });
const fixed = (value: unknown) => ({ type: "static", value });

describe("block rule condition operands", () => {
  test("a valid condition reports nothing", () => {
    const condition = { leftOperand: element("fav"), operator: "isSubmitted" };
    expect(operandIssues(condition)).toEqual([]);
    expect(ZSurvey.safeParse(withRuleOn(PROFILE, condition)).success).toBe(true);
  });

  test.each([
    [
      "an element that does not exist",
      { leftOperand: element("nope"), operator: "equals", rightOperand: fixed("x") },
      `Conditional Logic: Element Id nope does not exist ${where}`,
    ],
    [
      "an operator the element type does not support",
      { leftOperand: element("fav"), operator: "isBefore", rightOperand: fixed("x") },
      `Conditional Logic: Invalid operator "isBefore" for element type "multipleChoiceSingle" ${where}`,
    ],
    [
      "an operator a number open text does not support",
      { leftOperand: element("hours"), operator: "contains", rightOperand: fixed("x") },
      `Conditional Logic: Invalid operator "contains" for element type "openText" ${where}`,
    ],
    [
      "a CTA without an external button",
      { leftOperand: element("learn_more"), operator: "isClicked" },
      `Conditional Logic: CTA element "learn_more" does not have an external button and cannot be used in logic conditions ${where}`,
    ],
    [
      "a right operand on an operator that takes none",
      { leftOperand: element("apple_reason"), operator: "isSubmitted", rightOperand: fixed("x") },
      `Conditional Logic: Right operand should not be defined for operator "isSubmitted" ${where}`,
    ],
    [
      "an open text compared with an element of another type",
      { leftOperand: element("apple_reason"), operator: "equals", rightOperand: element("concept") },
      `Conditional Logic: Invalid element type "nps" for right operand ${where}`,
    ],
    [
      "an open text compared with a missing element",
      { leftOperand: element("apple_reason"), operator: "equals", rightOperand: element("nope") },
      `Conditional Logic: Element ID nope does not exist ${where}`,
    ],
    [
      "an open text compared with a missing computed field",
      {
        leftOperand: element("apple_reason"),
        operator: "equals",
        rightOperand: { type: "variable", value: MISSING_VARIABLE },
      },
      `Conditional Logic: Variable ID ${MISSING_VARIABLE} does not exist ${where}`,
    ],
    [
      "an open text compared with a missing hidden field",
      {
        leftOperand: element("apple_reason"),
        operator: "equals",
        rightOperand: { type: "hiddenField", value: "nope" },
      },
      `Conditional Logic: Hidden field ID nope does not exist ${where}`,
    ],
    [
      "a single choice compared with a computed field",
      {
        leftOperand: element("fav"),
        operator: "equals",
        rightOperand: { type: "variable", value: ids.variables.score },
      },
      `Conditional Logic: Right operand should be a static value for "equals" ${where}`,
    ],
    [
      "a single choice compared with a number",
      { leftOperand: element("fav"), operator: "equals", rightOperand: fixed(3) },
      `Conditional Logic: Right operand should be a string for "equals" ${where}`,
    ],
    [
      "a multi choice with a list operator on one value",
      { leftOperand: element("recommend"), operator: "includesAllOf", rightOperand: fixed("x") },
      `Conditional Logic: Right operand should be an array for "includesAllOf" ${where}`,
    ],
    [
      "a multi choice listing a choice it does not have",
      { leftOperand: element("recommend"), operator: "includesOneOf", rightOperand: fixed(["nope"]) },
      `Conditional Logic: One or more choices selected in right operand do not exist in the element ${where}`,
    ],
    [
      "a rating compared with a text computed field",
      {
        leftOperand: element("sat_netflix"),
        operator: "equals",
        rightOperand: { type: "variable", value: ids.variables.segment },
      },
      `Conditional Logic: Variable type should be number ${where}`,
    ],
    [
      "a rating compared with text",
      { leftOperand: element("sat_netflix"), operator: "equals", rightOperand: fixed("x") },
      `Conditional Logic: Right operand should be a number for "equals" ${where}`,
    ],
    [
      "a rating above its range",
      { leftOperand: element("sat_netflix"), operator: "equals", rightOperand: fixed(9) },
      `Conditional Logic: Rating value should be between 1 and 5 for "equals" ${where}`,
    ],
    [
      "an NPS score above 10",
      { leftOperand: element("concept"), operator: "equals", rightOperand: fixed(11) },
      `Conditional Logic: NPS score should be between 0 and 10 for "equals" ${where}`,
    ],
    [
      "a rating compared with a hidden field",
      {
        leftOperand: element("sat_netflix"),
        operator: "equals",
        rightOperand: { type: "hiddenField", value: ids.hiddenFields.seg },
      },
      `Conditional Logic: Right operand should be a variable or a static value for "equals" ${where}`,
    ],
    [
      "a date compared with an element of another type",
      { leftOperand: element("last_purchase"), operator: "isBefore", rightOperand: element("concept") },
      `Conditional Logic: Invalid element type "nps" for right operand ${where}`,
    ],
    [
      "a date compared with a number computed field",
      {
        leftOperand: element("last_purchase"),
        operator: "isBefore",
        rightOperand: { type: "variable", value: ids.variables.score },
      },
      `Conditional Logic: Variable type should be text ${where}`,
    ],
    [
      "a date compared with a value that is not a date",
      { leftOperand: element("last_purchase"), operator: "isBefore", rightOperand: fixed("not a date") },
      `Conditional Logic: Invalid date format for right operand ${where}`,
    ],
    [
      "a matrix row condition with a computed field",
      {
        leftOperand: element("brand_grid", { row: "0" }),
        operator: "equals",
        rightOperand: { type: "variable", value: ids.variables.score },
      },
      `Conditional Logic: Right operand should be a static value in matrix element ${where}`,
    ],
    [
      "a matrix row position past its rows",
      { leftOperand: element("brand_grid", { row: "99" }), operator: "equals", rightOperand: fixed("0") },
      `Conditional Logic: Invalid row index in matrix element ${where}`,
    ],
    [
      "a computed field that does not exist",
      {
        leftOperand: { type: "variable", value: MISSING_VARIABLE },
        operator: "equals",
        rightOperand: fixed(1),
      },
      `Conditional Logic: Variable ID ${MISSING_VARIABLE} does not exist ${where}`,
    ],
    [
      "a computed field compared with one that does not exist",
      {
        leftOperand: { type: "variable", value: ids.variables.score },
        operator: "equals",
        rightOperand: { type: "variable", value: MISSING_VARIABLE },
      },
      `Conditional Logic: Variable ID ${MISSING_VARIABLE} does not exist ${where}`,
    ],
    [
      "a hidden field that does not exist",
      { leftOperand: { type: "hiddenField", value: "nope" }, operator: "equals", rightOperand: fixed("x") },
      `Conditional Logic: Hidden field ID nope does not exist ${where}`,
    ],
  ])("refuses %s", (_, condition, message) => {
    expect(operandIssues(condition)).toContain(message);
  });

  test("refuses a whole-matrix condition with a right operand and a row operator", () => {
    expect(
      operandIssues({ leftOperand: element("brand_grid"), operator: "equals", rightOperand: fixed("0") })
    ).toEqual([
      `Conditional Logic: Right operand is not allowed in matrix element ${where}`,
      `Conditional Logic: Operator "equals" is not allowed in matrix element ${where}`,
    ]);
  });

  test("refuses a single choice compared with a choice it does not have", () => {
    expect(
      operandIssues({ leftOperand: element("fav"), operator: "equals", rightOperand: fixed("nope") })
    ).toEqual([
      expect.stringMatching(/^Conditional Logic: Choice "nope" does not exist in element \d+ of block 5$/),
    ]);
  });

  test("refuses an element in a later block", () => {
    expect(operandIssues({ leftOperand: element("fav"), operator: "isSubmitted" }, 0)).toEqual([
      "Conditional Logic: Block 1 cannot refer to an element in block 5 that appears later in the survey",
    ]);
  });
});
