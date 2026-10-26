import { describe, expect, test } from "vitest";
import { parseListInput, summarizeConditionValue } from "./value-input";

describe("parseListInput", () => {
  test("takes one entry per line and drops blank lines, which would match every URL", () => {
    expect(parseListInput("/plan-compare\n\n  /drug-coverage  \r\n\n")).toEqual([
      "/plan-compare",
      "/drug-coverage",
    ]);
  });

  test("never splits a line", () => {
    expect(parseListInput("/plans, /compare")).toEqual(["/plans, /compare"]);
  });
});

describe("summarizeConditionValue", () => {
  test("shows a list's first three entries and how many more there are", () => {
    expect(summarizeConditionValue({ rightOperand: { value: ["/a", "/b", "/c", "/d", "/e"] } })).toBe(
      "/a, /b, /c (+2)"
    );
    expect(summarizeConditionValue({ rightOperand: { value: 120 } })).toBe("120");
    expect(summarizeConditionValue({})).toBe("");
  });
});
