import { describe, expect, test } from "vitest";
import type { TSurveyBlockLogicAction } from "./blocks";
import { EXPRESSION_MAX_DEPTH, EXPRESSION_MAX_NODES, type TExpression } from "./expressions";
import { SURVEY_FLOW_FIXTURE_IDS, surveyFlowFixture } from "./test-fixtures/survey-flow-fixture";
import { type TSurvey, ZSurvey } from "./types";

/**
 * Save-time validation of Set value expressions (ENG-6935): every mistake fails with the exact path
 * into the tree, so the editor, v3 and MCP can point at it. Built on the shared fixture's always-run
 * score step (`score = round(…)`) and its `signed_up_at = now()` step.
 */

const ids = SURVEY_FLOW_FIXTURE_IDS;

const locate = (actionId: string) => {
  for (const [blockIdx, block] of surveyFlowFixture.blocks.entries()) {
    for (const [logicIdx, rule] of (block.logic ?? []).entries()) {
      const actionIdx = rule.actions.findIndex((action) => action.id === actionId);
      if (actionIdx !== -1) return { blockIdx, logicIdx, actionIdx };
    }
  }
  throw new Error(`No action ${actionId} in the fixture`);
};

/** The fixture with one action replaced. */
const withAction = (actionId: string, update: (action: TSurveyBlockLogicAction) => unknown): TSurvey => {
  const { blockIdx, logicIdx, actionIdx } = locate(actionId);
  const survey = structuredClone(surveyFlowFixture);
  const actions = survey.blocks[blockIdx].logic![logicIdx].actions;
  actions[actionIdx] = update(actions[actionIdx]) as TSurveyBlockLogicAction;
  return survey;
};

const withScoreExpression = (expression: unknown): TSurvey =>
  withAction(ids.setValue.scoreAction, (action) => ({
    ...action,
    value: { type: "expression", value: expression },
  }));

const valuePath = (actionId: string) => {
  const { blockIdx, logicIdx, actionIdx } = locate(actionId);
  return ["blocks", blockIdx, "logic", logicIdx, "actions", actionIdx, "value", "value"];
};

const issuesOf = (survey: TSurvey) =>
  (ZSurvey.safeParse(survey).error?.issues ?? []).map(({ path, message }) => ({ path, message }));

const scorePath = valuePath(ids.setValue.scoreAction);
const num = (value: number) => ({ type: "static", value });
const answer = (elementId: string) => ({ type: "element", value: elementId });
const call = (fn: string, ...args: unknown[]) => ({ type: "call", fn, args });

describe("Set value expression validation", () => {
  test("the fixture's expressions are valid", () => {
    expect(issuesOf(surveyFlowFixture)).toEqual([]);
  });

  test("refuses text in arithmetic at the text argument", () => {
    // apple_reason is a text open question.
    const issues = issuesOf(withScoreExpression(call("add", num(1), answer("apple_reason"))));

    expect(issues).toEqual([
      { path: [...scorePath, "args", 1], message: "Expression: + needs numbers, got text" },
    ]);
  });

  test("refuses an unknown function at its name", () => {
    const issues = issuesOf(withScoreExpression(call("add", num(1), call("power", num(2), num(3)))));

    expect(issues).toEqual([
      { path: [...scorePath, "args", 1, "fn"], message: "Expression: unknown function power()" },
    ]);
  });

  test.each([
    ["subtract with one argument", call("subtract", num(1)), "exactly 2 arguments, got 1"],
    ["abs with two arguments", call("abs", num(1), num(2)), "exactly 1 arguments, got 2"],
    ["now with an argument", call("now", num(1)), "exactly 0 arguments, got 1"],
    ["add with one argument", call("add", num(1)), "2 to 50 arguments, got 1"],
  ])("refuses %s at its arguments", (_label, inner, message) => {
    const issues = issuesOf(withScoreExpression(call("round", inner)));
    const arityIssue = issues.find((issue) => issue.message.includes("arguments"));

    expect(arityIssue?.path).toEqual([...scorePath, "args", 0, "args"]);
    expect(arityIssue?.message).toContain(message);
  });

  test("refuses round()'s decimals unless they are a fixed whole number from 0 to 10", () => {
    const issues = issuesOf(withScoreExpression(call("round", num(1.234), answer("sat_netflix"))));

    expect(issues.map((issue) => issue.path)).toEqual([[...scorePath, "args", 1]]);
  });

  test(`refuses a tree deeper than ${String(EXPRESSION_MAX_DEPTH)} levels at the first node past it`, () => {
    let tree: unknown = num(1);
    for (let level = 1; level < EXPRESSION_MAX_DEPTH + 1; level++) tree = call("abs", tree);
    const tooDeepPath = [
      ...scorePath,
      ...Array.from({ length: EXPRESSION_MAX_DEPTH }, () => ["args", 0]).flat(),
    ];

    expect(issuesOf(withScoreExpression(tree))).toEqual([
      { path: tooDeepPath, message: `Expression: nested deeper than ${String(EXPRESSION_MAX_DEPTH)} levels` },
    ]);
    // One level less is fine.
    let allowed: unknown = num(1);
    for (let level = 1; level < EXPRESSION_MAX_DEPTH; level++) allowed = call("abs", allowed);
    expect(issuesOf(withScoreExpression(allowed))).toEqual([]);
  });

  test("refuses a hostile tree thousands of levels deep with one issue at its path, before parsing it", () => {
    let tree: unknown = num(1);
    for (let level = 0; level < 20_000; level++) tree = call("abs", tree);
    const tooDeepPath = [
      ...scorePath,
      ...Array.from({ length: EXPRESSION_MAX_DEPTH }, () => ["args", 0]).flat(),
    ];

    expect(issuesOf(withScoreExpression(tree))).toEqual([
      { path: tooDeepPath, message: `Expression: nested deeper than ${String(EXPRESSION_MAX_DEPTH)} levels` },
    ]);
  });

  test(`refuses more than ${String(EXPRESSION_MAX_NODES)} nodes at the root`, () => {
    const wide = (count: number) =>
      call(
        "add",
        ...Array.from({ length: 4 }, () => call("add", ...Array.from({ length: count }, () => num(1))))
      );

    // 1 + 4 × (1 + 50) = 205 nodes; 1 + 4 × (1 + 48) = 197.
    expect(issuesOf(withScoreExpression(wide(50)))).toEqual([
      { path: scorePath, message: `Expression: more than ${String(EXPRESSION_MAX_NODES)} nodes` },
    ]);
    expect(issuesOf(withScoreExpression(wide(48)))).toEqual([]);
  });

  test("refuses a reference to a question that doesn't exist, or one a formula can't use", () => {
    expect(issuesOf(withScoreExpression(call("add", num(1), answer("gone"))))).toEqual([
      { path: [...scorePath, "args", 1, "value"], message: "Expression: question gone does not exist" },
    ]);
    // `services` is a multi select.
    expect(issuesOf(withScoreExpression(call("add", num(1), answer("services"))))).toEqual([
      {
        path: [...scorePath, "args", 1, "value"],
        message: "Expression: a multipleChoiceMulti question can't be used in a formula",
      },
    ]);
  });

  test("refuses a result that doesn't fit the target field", () => {
    const issues = issuesOf(withScoreExpression(call("concat", answer("fav"), num(1))));

    expect(issues).toEqual([
      { path: scorePath, message: "Expression: the result is text, but the field holds number" },
    ]);
  });

  test("daysBetween needs dates; a fixed ISO date is one", () => {
    expect(
      issuesOf(
        withScoreExpression(
          call("daysBetween", answer("last_purchase"), { type: "static", value: "2026-01-01" })
        )
      )
    ).toEqual([]);
    expect(issuesOf(withScoreExpression(call("daysBetween", answer("last_purchase"), num(3))))).toEqual([
      { path: [...scorePath, "args", 1], message: "Expression: daysBetween() needs a date, got number" },
    ]);
  });

  test("a computed date field takes now(), but not a one-step operator", () => {
    const signedUpPath = valuePath(ids.setValue.signedUpAction);

    expect(
      issuesOf(
        withAction(ids.setValue.signedUpAction, (action) => ({
          ...action,
          value: { type: "expression", value: num(1) },
        }))
      )
    ).toEqual([
      { path: signedUpPath, message: "Expression: the result is number, but the field holds date" },
    ]);

    const oneStep = issuesOf(
      withAction(ids.setValue.signedUpAction, (action) => ({
        ...action,
        operator: "assign",
        value: { type: "static", value: "2026-01-01" },
      }))
    );
    expect(oneStep.map((issue) => issue.path)).toEqual([signedUpPath.slice(0, -1)]);
  });

  test("an empty formula is refused", () => {
    expect(issuesOf(withScoreExpression({ type: "static", value: "" }))).toEqual([
      { path: scorePath, message: "Expression: enter a formula" },
    ]);
  });

  test("a single-select answer is text: fine in concat, refused in arithmetic", () => {
    expect(issuesOf(withScoreExpression(call("add", num(1), answer("fav"))))).toEqual([
      { path: [...scorePath, "args", 1], message: "Expression: + needs numbers, got text" },
    ]);
  });
});

// Keeps the type import honest: an expression literal is a TExpression.
const _typed: TExpression = { type: "call", fn: "now", args: [] };
void _typed;
