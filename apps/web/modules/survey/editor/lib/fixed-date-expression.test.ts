import { describe, expect, test } from "vitest";
import {
  SURVEY_FLOW_FIXTURE_IDS as ids,
  surveyFlowFixture,
} from "@formbricks/types/surveys/test-fixtures/survey-flow-fixture";
import { formatFormula, getFormulaIssues, getFormulaReferences, parseFormula } from "./expression-formula";
import { getFixedDate, toFixedDateExpression } from "./fixed-date-expression";

const references = getFormulaReferences(surveyFlowFixture);

describe("getFixedDate: an expression that is one date reopens with that date (ENG-6968)", () => {
  test("a date literal, as typed or as picked", () => {
    expect(getFixedDate({ type: "static", value: "2026-11-05" })).toBe("2026-11-05");
    const typed = parseFormula('"2026-11-05"', references);
    expect(typed.ok && getFixedDate(typed.expression)).toBe("2026-11-05");
    expect(getFixedDate({ type: "static", value: "2026-11-05T10:00:00.000Z" })).toBe(
      "2026-11-05T10:00:00.000Z"
    );
  });

  test("now(), a formula, other text and an empty box hold no fixed date", () => {
    expect(getFixedDate({ type: "call", fn: "now", args: [] })).toBeNull();
    expect(getFixedDate({ type: "static", value: "next week" })).toBeNull();
    expect(getFixedDate({ type: "static", value: "" })).toBeNull();
    expect(getFixedDate({ type: "static", value: 20261105 })).toBeNull();
  });
});

describe("toFixedDateExpression: a picked day is the quoted ISO date in the expression", () => {
  test("reads in the box as the date in quotes, and a save accepts it for a date field", () => {
    const expression = toFixedDateExpression("2026-11-05");
    expect(formatFormula(expression, references)).toBe('"2026-11-05"');
    expect(getFixedDate(expression)).toBe("2026-11-05");
    expect(getFormulaIssues(expression, ids.variables.signedUpAt, surveyFlowFixture)).toEqual([]);
  });
});
