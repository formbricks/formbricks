import { describe, expect, test } from "vitest";
import { EXPRESSION_MAX_STATIC_TEXT_LENGTH, type TExpression } from "@formbricks/types/surveys/expressions";
import {
  SURVEY_FLOW_FIXTURE_IDS,
  surveyFlowFixture,
} from "@formbricks/types/surveys/test-fixtures/survey-flow-fixture";
import {
  FORMULA_CHIP_FUNCTIONS,
  FORMULA_FUNCTION_EXAMPLES,
  FORMULA_MAX_LENGTH,
  formatFormula,
  formatReferenceToken,
  formulaToOneStep,
  getFormulaExample,
  getFormulaIssues,
  getFormulaReferences,
  getFormulaToWriteOnBlur,
  getFunctionSnippet,
  getShownFormulaError,
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
    ["1 + @", "incomplete_reference", 4],
    ["@ + 1", "incomplete_reference", 0],
    ["1 + @{Plan tier", "unexpected_end", 4],
  ])("refuses %j with %s at %d", (text, code, position) => {
    expect(parse(text)).toEqual({ ok: false, error: expect.objectContaining({ code, position }) });
  });

  test("a number may start with its decimal point, and text may sit in curly quotes", () => {
    expect(tree(".5 + 1")).toEqual(call("add", num(0.5), num(1)));
    expect(tree("concat(“a”, @fav)")).toEqual(call("concat", { type: "static", value: "a" }, answer("fav")));
  });

  test("the longest text the box takes fits a stored step, so the box's length is the only limit", () => {
    const longest = `"${"x".repeat(FORMULA_MAX_LENGTH - 2)}"`;
    const value = (tree(longest) as { value: string }).value;
    expect(value.length).toBeLessThanOrEqual(EXPRESSION_MAX_STATIC_TEXT_LENGTH);
    expect(parse(`"${"x".repeat(FORMULA_MAX_LENGTH - 1)}"`)).toEqual({
      ok: false,
      error: { code: "too_long", position: FORMULA_MAX_LENGTH },
    });
  });
});

describe("oneStepToFormula: turning the formula toggle on for a one-step calculation", () => {
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

describe("formulaToOneStep: turning the formula off goes back to one step when nothing is lost", () => {
  const score = ids.variables.score;
  const back = (text: string) => formulaToOneStep(tree(text), score);

  test.each([
    ["ifEmpty(@score, 0) + 1", { operator: "add", value: { type: "static", value: 1 } }],
    ["ifEmpty(@score, 0) - 2", { operator: "subtract", value: { type: "static", value: 2 } }],
    ["ifEmpty(@score, 0) * @hours", { operator: "multiply", value: { type: "element", value: "hours" } }],
    ["ifEmpty(@score, 0) / 4", { operator: "divide", value: { type: "static", value: 4 } }],
    ['concat(ifEmpty(@score, ""), "-x")', { operator: "concat", value: { type: "static", value: "-x" } }],
    ["@tenure_days", { operator: "assign", value: { type: "variable", value: ids.variables.tenureDays } }],
    ["7", { operator: "assign", value: { type: "static", value: 7 } }],
  ])("%s", (text, oneStep) => {
    expect(back(text)).toEqual(oneStep);
  });

  test("every one-step calculation comes back as itself", () => {
    const oneSteps = [
      { operator: "add", value: { type: "static" as const, value: 1 } },
      { operator: "divide", value: { type: "element" as const, value: "hours" } },
      { operator: "concat", value: { type: "static" as const, value: "-x" } },
      { operator: "assign", value: { type: "hiddenField" as const, value: "panel_id" } },
    ];
    for (const oneStep of oneSteps) {
      expect(formulaToOneStep(oneStepToFormula({ variableId: score, ...oneStep }), score)).toEqual(oneStep);
    }
  });

  test("an empty formula is an empty value to assign", () => {
    expect(formulaToOneStep({ type: "static", value: "" }, score)).toEqual({
      operator: "assign",
      value: { type: "static", value: "" },
    });
  });

  test.each([
    ["more than one step", "ifEmpty(@score, 0) + 1 + 2"],
    ["a function one step can't write", "round(@sat_netflix)"],
    ["another field's current value", "ifEmpty(@tenure_days, 0) + 1"],
    ["a fallback other than empty-counts-as-zero", "ifEmpty(@score, 5) + 1"],
    ["the field's value without ifEmpty", "@score + 1"],
    ["a nested operand", "ifEmpty(@score, 0) + (1 + 2)"],
  ])("%s can't be one step", (_label, text) => {
    expect(back(text)).toBeNull();
  });
});

describe("getShownFormulaError: what the box says while it is typed in", () => {
  const shown = (text: string, isReferenceMenuOpen = false) => {
    const result = parse(text);
    return result.ok ? null : getShownFormulaError(result.error, { text, isReferenceMenuOpen });
  };

  test("a bare @ just typed is a reference being picked, not a mistake", () => {
    expect(shown("@")).toBeNull();
    expect(shown("round(@q1 * @ ")).toBeNull();
  });

  test("a bare @ with more formula after it is reported, without naming a reference", () => {
    expect(shown("@ + 1")).toEqual({ code: "incomplete_reference", position: 0 });
  });

  test("nothing is reported while the reference menu is open", () => {
    expect(shown("1 + ", true)).toBeNull();
    expect(shown("1 + ")).toEqual(expect.objectContaining({ code: "unexpected_end" }));
  });

  test("other mistakes are reported as parsed", () => {
    expect(shown("@nope")).toEqual(expect.objectContaining({ code: "unknown_reference", detail: "nope" }));
  });

  test("nothing is reported mid-typing; the same mistake shows once typing pauses or the box loses focus", () => {
    const result = parse("ro(");
    if (result.ok) throw new Error("expected a parse error");
    expect(
      getShownFormulaError(result.error, { text: "ro(", isReferenceMenuOpen: false, isTyping: true })
    ).toBeNull();
    expect(
      getShownFormulaError(result.error, { text: "ro(", isReferenceMenuOpen: false, isTyping: false })
    ).toEqual(expect.objectContaining({ code: "unknown_function" }));
  });
});

describe("getFormulaToWriteOnBlur: a half-typed formula never keeps the last one that parsed", () => {
  test("text that doesn't parse writes the empty formula, which a save refuses at the step", () => {
    // Stored `@sat_netflix * 20`; the author typed `round(` in front and left the box.
    expect(getFormulaToWriteOnBlur("round(@sat_netflix * 20", references)).toEqual({
      type: "static",
      value: "",
    });
    expect(getFormulaToWriteOnBlur("@nope + 1", references)).toEqual({ type: "static", value: "" });
  });

  test("a formula that parses, or an emptied box, was already written while typing", () => {
    expect(getFormulaToWriteOnBlur("round(@sat_netflix * 20)", references)).toBeNull();
    expect(getFormulaToWriteOnBlur("  ", references)).toBeNull();
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

describe("formula box help: the placeholder and the function chips", () => {
  test("the placeholder's example uses the first number question answered by the time the step runs", () => {
    // Ratings is the second block: from there on, its first rating is the example.
    expect(getFormulaExample(references, 1)).toBe("round(@sat_netflix * 20)");
    expect(getFormulaExample(references, 4)).toBe("round(@sat_netflix * 20)");
  });

  test("with no number question answered yet, the example is a generic one", () => {
    expect(getFormulaExample(references, 0)).toBe("round(@q1 * 20)");
    expect(getFormulaExample(references, -1)).toBe("round(@q1 * 20)");
    expect(getFormulaExample([], 3)).toBe("round(@q1 * 20)");
  });

  test("the chips offer every function but the four the operators write", () => {
    expect(FORMULA_CHIP_FUNCTIONS).toEqual([
      "round",
      "min",
      "max",
      "abs",
      "ifEmpty",
      "concat",
      "now",
      "daysBetween",
    ]);
  });

  test("every chip's example is a formula that calls that function", () => {
    const generic = (["q1", "q2"] as const).map((token, blockIdx) => ({
      token,
      leaf: { type: "element" as const, value: token },
      group: "question" as const,
      usable: true,
      blockIdx,
    }));
    for (const fn of FORMULA_CHIP_FUNCTIONS) {
      const parsed = parseFormula(FORMULA_FUNCTION_EXAMPLES[fn], generic);
      expect(parsed.ok && parsed.expression).toMatchObject({ type: "call", fn });
    }
  });
});

describe("getFormulaIssues: what a save would refuse, while typing", () => {
  test("text in arithmetic is named at its path; a fitting formula has none", () => {
    expect(getFormulaIssues(tree("@hours + @apple_reason"), ids.variables.score, surveyFlowFixture)).toEqual([
      {
        path: ["args", 1],
        message: "Expression: + needs numbers, got text",
        // What the formula box words in the author's language.
        code: "needs_numbers",
        params: { fn: "+", wanted: "number", got: "text" },
      },
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
