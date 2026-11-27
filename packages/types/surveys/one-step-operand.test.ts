import { describe, expect, test } from "vitest";
import type { TEmbeddedDataType } from "../embedded-data";
import {
  type TOneStepOperandSources,
  type TOneStepOperandValue,
  getOneStepOperand,
} from "./one-step-operand";

const sources: Omit<TOneStepOperandSources, "dataType"> = {
  data: { q1: "42", plan: "gold", blank: "  ", huge: "1e999", inf: "Infinity" },
  variables: { score: 7, label: "vip", flag: true },
  reservedValues: {
    visitPagesViewed: 6,
    pagePath: "/pricing",
    url: "https://example.com/pricing",
    screenWidth: "1280",
    huge: "1e999",
  },
};

describe("getOneStepOperand", () => {
  test.each<[string, TOneStepOperandValue, TEmbeddedDataType, string | number]>([
    ["a static number", { type: "static", value: 3 }, "number", 3],
    ["a static text", { type: "static", value: "x" }, "string", "x"],
    ["a variable", { type: "variable", value: "score" }, "number", 7],
    ["an answer as a number", { type: "element", value: "q1" }, "number", 42],
    ["an answer as text for a text field", { type: "element", value: "q1" }, "string", "42"],
    ["a hidden field that is not a number", { type: "hiddenField", value: "plan" }, "number", "gold"],
    // ENG-7431
    ["a reserved field as a number", { type: "reserved", value: "visitPagesViewed" }, "number", 6],
    ["a reserved field as text", { type: "reserved", value: "pagePath" }, "string", "/pricing"],
    // Stored as text, as the formula form stores a number reserved field in a text field.
    ["a number reserved field as text", { type: "reserved", value: "visitPagesViewed" }, "string", "6"],
    ["numeric reserved text as a number", { type: "reserved", value: "screenWidth" }, "number", 1280],
  ])("reads %s", (_label, operand, dataType, expected) => {
    expect(getOneStepOperand(operand, { ...sources, dataType })).toBe(expected);
  });

  test.each<[string, TOneStepOperandValue]>([
    ["a static true or false", { type: "static", value: true }],
    ["a true/false variable", { type: "variable", value: "flag" }],
    ["a missing answer", { type: "element", value: "q9" }],
    ["a reserved field the evaluator does not have", { type: "reserved", value: "country" }],
    ['a legacy "question" operand', { type: "question", value: "q1" }],
    // A text reserved field cannot feed a number field: `"https://…" + 1` would be NaN.
    ["a text reserved field for a number field", { type: "reserved", value: "url" }],
    ["a lowercased reserved name", { type: "reserved", value: "visitpagesviewed" }],
    ["an inherited object key", { type: "reserved", value: "constructor" }],
    // Text that reads as a number that is not finite: the formula form reads it as empty.
    ["reserved text past the number range", { type: "reserved", value: "huge" }],
    ["an answer past the number range", { type: "element", value: "huge" }],
    ["a hidden field reading Infinity", { type: "hiddenField", value: "inf" }],
  ])("has nothing to apply for %s", (_label, operand) => {
    expect(getOneStepOperand(operand, { ...sources, dataType: "number" })).toBeUndefined();
  });

  // A survey that was not re-parsed can carry an operand the types rule out; it must apply nothing
  // rather than write the object (assign), NaN (add) or "[object Object]" (concat) into the field.
  test.each([
    ["an operand kind this version does not know", { type: "futureKind", value: "x" }],
    ["a static object", { type: "static", value: { nested: true } }],
    ["a reference whose id is not text", { type: "hiddenField", value: 42 }],
  ])("has nothing to apply for %s", (_label, operand) => {
    expect(
      getOneStepOperand(operand as unknown as TOneStepOperandValue, { ...sources, dataType: "string" })
    ).toBeUndefined();
  });

  test.each([Number.NaN, Number.POSITIVE_INFINITY])("treats a reserved %s as nothing to apply", (value) => {
    const reservedValues = { visitPagesViewed: value };
    for (const dataType of ["number", "string"] as const) {
      expect(
        getOneStepOperand(
          { type: "reserved", value: "visitPagesViewed" },
          { data: {}, variables: {}, reservedValues, dataType }
        )
      ).toBeUndefined();
    }
  });

  test("reads nothing from reserved fields when the evaluator has none", () => {
    expect(
      getOneStepOperand(
        { type: "reserved", value: "visitPagesViewed" },
        { data: {}, variables: {}, dataType: "number" }
      )
    ).toBeUndefined();
  });

  // `Number("  ")` is 0, which would turn a blank field into a real 0.
  test("keeps a blank text blank for a number field", () => {
    expect(
      getOneStepOperand({ type: "hiddenField", value: "blank" }, { ...sources, dataType: "number" })
    ).toBe("  ");
  });
});
