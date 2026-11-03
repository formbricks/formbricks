import { describe, expect, test } from "vitest";
import { surveyFlowFixture } from "@formbricks/types/surveys/test-fixtures/survey-flow-fixture";
import { getFormulaReferences, parseFormula } from "./expression-formula";
import { getSampleResult } from "./expression-sample";

const references = getFormulaReferences(surveyFlowFixture);
const NOW = new Date("2026-11-03T12:00:00.000Z");

const sample = (text: string, dataType: "number" | "string" | "date" = "number") => {
  const parsed = parseFormula(text, references);
  if (!parsed.ok) throw new Error(parsed.error.code);
  return getSampleResult(parsed.expression, dataType, surveyFlowFixture, NOW);
};

describe("getSampleResult: the formula box's result for a made-up response", () => {
  test("arithmetic over sample answers (two 5-point ratings at 4)", () => {
    expect(sample("round(@sat_netflix + @sat_disney * 2)")).toBe(12);
  });

  test("a single select yields the first option's answer code", () => {
    expect(sample('concat("fav-", @fav)', "string")).toMatch(/^fav-.+/);
    expect(sample('concat("fav-", @fav)', "string")).not.toBe("fav-");
  });

  test("dates: now() and daysBetween() from a sample date 30 days back", () => {
    expect(sample("now()", "date")).toBe("2026-11-03T12:00:00.000Z");
    expect(sample("daysBetween(@last_purchase, now())")).toBe(30);
  });

  test("a result that is empty shows as empty", () => {
    expect(sample("1 / 0")).toBe("");
  });
});
