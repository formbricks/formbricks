import { describe, expect, test } from "vitest";
import { surveyFlowFixture } from "@formbricks/types/surveys/test-fixtures/survey-flow-fixture";
import { getFormulaReferences, parseFormula } from "./expression-formula";
import {
  formatSampleInput,
  formatSampleResult,
  getSampleExplanation,
  getSampleResult,
} from "./expression-sample";

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

describe("getSampleExplanation: the sample result names its inputs (ENG-6950)", () => {
  const explain = (text: string, dataType: "number" | "string" | "date" = "number") => {
    const parsed = parseFormula(text, references);
    if (!parsed.ok) throw new Error(parsed.error.code);
    return getSampleExplanation(parsed.expression, dataType, surveyFlowFixture, NOW);
  };

  test("each answer the formula reads, once, in order, with its sample value and the result", () => {
    expect(explain("round(@sat_netflix + @sat_disney * 2 + @sat_netflix)")).toEqual({
      inputs: [
        { name: "@sat_netflix", value: 4, valueType: "number" },
        { name: "@sat_disney", value: 4, valueType: "number" },
      ],
      result: 16,
    });
  });

  test("a single select reads as the answer code the formula sees, a date field as a date", () => {
    const { inputs } = explain('concat("fav-", @fav, @signed_up_at)', "string");
    expect(inputs[0]).toMatchObject({ name: "@fav", valueType: "text" });
    expect(inputs[0].value).toBe(sample('concat("", @fav)', "string"));
    expect(inputs[1]).toMatchObject({ name: "@signed_up_at", valueType: "date" });
  });

  test("a formula without references has no inputs", () => {
    expect(explain("now()", "date")).toEqual({ inputs: [], result: "2026-11-03T12:00:00.000Z" });
  });

  test("inputs read as the sentence shows them: text quoted, dates formatted, empty as undefined", () => {
    expect(formatSampleInput({ name: "@a", value: 4, valueType: "number" }, "en-US")).toBe("4");
    expect(formatSampleInput({ name: "@a", value: "gold", valueType: "text" }, "en-US")).toBe("“gold”");
    expect(formatSampleInput({ name: "@a", value: "2026-10-04", valueType: "date" }, "en-US", "UTC")).toBe(
      "Oct 4, 2026"
    );
    expect(formatSampleInput({ name: "@a", value: undefined, valueType: "text" }, "en-US")).toBeUndefined();
  });
});

describe("formatSampleResult: how the sample result reads", () => {
  test("a timestamp reads as a local date and time, with the ISO value as its title", () => {
    const shown = formatSampleResult("2026-11-03T20:33:49.616Z", "date", "en-US", "UTC");
    expect(shown.text).toMatch(/^Nov 3, 2026, 8:33\sPM$/);
    expect(shown.title).toBe("2026-11-03T20:33:49.616Z");
  });

  test("a calendar date reads as that day in any time zone", () => {
    expect(formatSampleResult("2026-10-04", "date", "en-US", "Pacific/Honolulu")).toEqual({
      text: "Oct 4, 2026",
      title: "2026-10-04",
    });
  });

  test("numbers and text read as they are", () => {
    expect(formatSampleResult(80, "number", "en-US")).toEqual({ text: "80" });
    expect(formatSampleResult("ACME-123", "string", "en-US")).toEqual({ text: "ACME-123" });
  });
});
