import { describe, expect, test } from "vitest";
import { getOneStepOperand } from "./one-step-operand";

const sources = {
  data: { q1: "42", plan: "gold", blank: "  " },
  variables: { score: 7, label: "vip", flag: true },
  reservedValues: { visitpagesviewed: "6", pagepath: "/pricing" },
};
const operand = (type: string, value: unknown) => ({ value: { type, value } });

describe("getOneStepOperand", () => {
  test.each([
    ["a static number", operand("static", 3), "number", 3],
    ["a static text", operand("static", "x"), "string", "x"],
    ["a variable", operand("variable", "score"), "number", 7],
    ["an answer as a number", operand("element", "q1"), "number", 42],
    ["an answer as text for a text field", operand("element", "q1"), "string", "42"],
    ["a hidden field that is not a number", operand("hiddenField", "plan"), "number", "gold"],
    // ENG-7431
    ["a reserved field as a number", operand("reserved", "visitpagesviewed"), "number", 6],
    ["a reserved field as text", operand("reserved", "pagepath"), "string", "/pricing"],
  ])("reads %s", (_label, action, dataType, expected) => {
    expect(getOneStepOperand(action, { ...sources, dataType })).toBe(expected);
  });

  test.each([
    ["a static true or false", operand("static", true)],
    ["a true/false variable", operand("variable", "flag")],
    ["a missing answer", operand("element", "q9")],
    ["a reserved field the evaluator does not have", operand("reserved", "country")],
    ['a legacy "question" operand', operand("question", "q1")],
  ])("has nothing to apply for %s", (_label, action) => {
    expect(getOneStepOperand(action, { ...sources, dataType: "number" })).toBeUndefined();
  });

  test("reads nothing from reserved fields when the evaluator has none", () => {
    expect(
      getOneStepOperand(operand("reserved", "visitpagesviewed"), {
        data: {},
        variables: {},
        dataType: "number",
      })
    ).toBeUndefined();
  });

  // `Number("  ")` is 0, which would turn a blank field into a real 0.
  test("keeps a blank text blank for a number field", () => {
    expect(getOneStepOperand(operand("hiddenField", "blank"), { ...sources, dataType: "number" })).toBe("  ");
  });
});
