import { describe, expect, test } from "vitest";
import type { TExpression } from "@formbricks/types/surveys/expressions";
import {
  SURVEY_FLOW_FIXTURE_IDS,
  surveyFlowFixture,
} from "@formbricks/types/surveys/test-fixtures/survey-flow-fixture";
import {
  formatFormula,
  formatReferenceToken,
  getFormulaIssues,
  getFormulaReferences,
  getFunctionSnippet,
  insertIntoFormula,
  oneStepToFormula,
  parseFormula,
} from "./expression-formula";

const ids = SURVEY_FLOW_FIXTURE_IDS;
const references = getFormulaReferences(surveyFlowFixture);
const parse = (text: string) => parseFormula(text, references);
const tree = (text: string): TExpression => {
  const result = parse(text);
  if (!result.ok) throw new Error(`${text}: ${result.error.code} at ${String(result.error.position)}`);
  return result.expression;
};

const num = (value: number) => ({ type: "static", value });
const answer = (elementId: string) => ({ type: "element", value: elementId });
const call = (fn: string, ...args: unknown[]) => ({ type: "call", fn, args });

describe("parseFormula: typed text into the tree AI writes", () => {
  test("round(q1 + q2 * 2) with precedence", () => {
    expect(tree("round(@sat_netflix + @sat_disney * 2)")).toEqual(
      call("round", call("add", answer("sat_netflix"), call("multiply", answer("sat_disney"), num(2))))
    );
  });

  test("a chain of + is one add; brackets keep a nested one", () => {
    expect(tree("1 + 2 + 3")).toEqual(call("add", num(1), num(2), num(3)));
    expect(tree("(1 + 2) + 3")).toEqual(call("add", call("add", num(1), num(2)), num(3)));
    expect(tree("2 * 3 * 4")).toEqual(call("multiply", num(2), num(3), num(4)));
  });

  test("- and / are left to right", () => {
    expect(tree("10 - 4 - 1")).toEqual(call("subtract", call("subtract", num(10), num(4)), num(1)));
    expect(tree("8 / 2 / 2")).toEqual(call("divide", call("divide", num(8), num(2)), num(2)));
  });

  test("× ÷ − read as * / -, and a leading minus on a number is a negative number", () => {
    expect(tree("6 × 2 ÷ 3 − -1")).toEqual(
      call("subtract", call("divide", call("multiply", num(6), num(2)), num(3)), num(-1))
    );
    expect(tree("-@hours")).toEqual(call("multiply", num(-1), answer("hours")));
  });

  test("references: questions by code, fields by name (braced when not a plain name), reserved fields", () => {
    expect(tree("@score")).toEqual({ type: "variable", value: ids.variables.score });
    expect(tree("@{Plan tier}")).toEqual({ type: "hiddenField", value: ids.hiddenFields.planTier });
    expect(tree("@signup_date")).toEqual({ type: "hiddenField", value: ids.hiddenFields.signupDate });
    expect(tree("@language")).toEqual({ type: "reserved", value: "language" });
  });

  test("functions in any case, with text and dates in quotes", () => {
    expect(tree('IFEMPTY(@fav, "none")')).toEqual(
      call("ifEmpty", answer("fav"), { type: "static", value: "none" })
    );
    expect(tree("daysBetween(@last_purchase, now())")).toEqual(
      call("daysBetween", answer("last_purchase"), call("now"))
    );
    expect(tree('concat("a \\"b\\"", @fav)')).toEqual(
      call("concat", { type: "static", value: 'a "b"' }, answer("fav"))
    );
  });

  test("argument counts are left to the shared validator", () => {
    expect(tree("abs(1, 2)")).toEqual(call("abs", num(1), num(2)));
  });

  test.each([
    ["", "empty", 0],
    ["1 +", "unexpected_end", 3],
    ["1 2", "unexpected_token", 2],
    ["power(2, 3)", "unknown_function", 0],
    ["@nope + 1", "unknown_reference", 0],
    ['"open', "unclosed_text", 0],
    ["1 # 2", "unexpected_character", 2],
    ["round(1", "unexpected_end", 7],
  ])("refuses %j with %s at %d", (text, code, position) => {
    expect(parse(text)).toEqual({ ok: false, error: expect.objectContaining({ code, position }) });
  });
});

describe("oneStepToFormula: Use a formula on a one-step calculation", () => {
  test.each([
    ["add 1", { operator: "add", value: { type: "static", value: 1 } }, "ifEmpty(@score, 0) + 1"],
    [
      "divide by an answer",
      { operator: "divide", value: { type: "element", value: "hours" } },
      "ifEmpty(@score, 0) / @hours",
    ],
    [
      "assign a field",
      { operator: "assign", value: { type: "variable", value: ids.variables.tenureDays } },
      "@tenure_days",
    ],
    [
      "concat text",
      { operator: "concat", value: { type: "static", value: "-x" } },
      'concat(ifEmpty(@score, ""), "-x")',
    ],
  ])("%s", (_label, action, text) => {
    expect(formatFormula(oneStepToFormula({ variableId: ids.variables.score, ...action }), references)).toBe(
      text
    );
  });
});

describe("chips and @ insert at the cursor", () => {
  test("a function chip inserts its brackets with the cursor inside; now() puts it after", () => {
    const round = getFunctionSnippet("round");
    expect(
      insertIntoFormula("1 + ", { start: 4, end: 4 }, round.text, { cursorOffset: round.cursorOffset })
    ).toEqual({
      text: "1 + round()",
      cursor: 10,
    });
    expect(getFunctionSnippet("now")).toEqual({ text: "now()", cursorOffset: 5 });
  });

  test("a picked reference replaces the @ just typed, and a selection", () => {
    expect(insertIntoFormula("1 + @", { start: 5, end: 5 }, "@score", { replaceTypedAt: true })).toEqual({
      text: "1 + @score",
      cursor: 10,
    });
    expect(insertIntoFormula("1 + 2", { start: 4, end: 5 }, "@score")).toEqual({
      text: "1 + @score",
      cursor: 10,
    });
  });
});

describe("getFormulaIssues: what a save would refuse, while typing", () => {
  test("text in arithmetic is named at its path; a fitting formula has none", () => {
    expect(getFormulaIssues(tree("@hours + @apple_reason"), ids.variables.score, surveyFlowFixture)).toEqual([
      { path: ["args", 1], message: "Expression: + needs numbers, got text" },
    ]);
    expect(getFormulaIssues(tree("now()"), ids.variables.signedUpAt, surveyFlowFixture)).toEqual([]);
  });
});

describe("formatFormula: a stored tree as text that parses back to the same tree", () => {
  const roundTrip = (expression: TExpression) => parse(formatFormula(expression, references));

  test.each([
    ["the fixture's score step", "round(ifEmpty(@sat_netflix, 0) + ifEmpty(@sat_disney, 0) * 2, 1)"],
    ["nested same operation", "(1 + 2) + 3"],
    ["right-hand subtraction", "10 - (4 - 1)"],
    ["a sum inside a product", "(@hours + 1) * 2"],
    ["a negative number", "@hours - -3"],
    ["text with a quote", 'concat("say \\"hi\\"", @fav)'],
    ["a braced field", "concat(@{Plan tier}, @segment)"],
  ])("%s", (_label, text) => {
    const expression = tree(text);

    expect(formatFormula(expression, references)).toBe(text);
    expect(roundTrip(expression)).toEqual({ ok: true, expression });
  });

  test("every Set value step of the shared fixture round-trips", () => {
    const expressions = surveyFlowFixture.blocks
      .flatMap((block) => block.logic ?? [])
      .flatMap((rule) => rule.actions)
      .flatMap((action) =>
        action.objective === "calculate" && action.value.type === "expression" ? [action.value.value] : []
      );

    expect(expressions.length).toBeGreaterThan(0);
    for (const expression of expressions) {
      expect(roundTrip(expression)).toEqual({ ok: true, expression });
    }
  });

  test("a reference the survey no longer has reads as its stored id", () => {
    expect(formatFormula(call("add", answer("gone"), num(1)) as TExpression, references)).toBe("@gone + 1");
    expect(formatReferenceToken("a b")).toBe("@{a b}");
  });
});
