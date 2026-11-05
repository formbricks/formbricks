import { describe, expect, test } from "vitest";
import { getRuleValueControl } from "./rule-value-control";
import type { TFilterProperty } from "./types";

const property = (overrides: Partial<TFilterProperty>): TFilterProperty => ({
  id: "field",
  label: "Field",
  valueType: "string",
  ruleOperators: ["equals"],
  ...overrides,
});

const loadOptions = async () => ({ options: [], hasMore: false });

describe("getRuleValueControl", () => {
  test("holds the slot until a property and an operator are chosen", () => {
    expect(getRuleValueControl(undefined, "equals")).toBe("placeholder");
    expect(getRuleValueControl(property({}), "")).toBe("placeholder");
  });

  test("shows nothing for an operator that compares against nothing", () => {
    expect(getRuleValueControl(property({}), "isSet")).toBe("none");
    expect(getRuleValueControl(property({}), "isNotSet")).toBe("none");
  });

  test("leaves a list operator on fixed options to the editor's multi-pick", () => {
    expect(getRuleValueControl(property({ valueType: "enum", options: [] }), "includesOneOf")).toBe("editor");
  });

  test("picks several values for is any of / is none of, and for any list operator on looked-up values", () => {
    const fixed = property({ valueType: "enum", options: [{ value: "a", label: "A" }] });
    expect(getRuleValueControl(fixed, "isAnyOf")).toBe("multiPicker");
    expect(getRuleValueControl(fixed, "isNoneOf")).toBe("multiPicker");
    const categorical = property({ valueType: "enum", loadOptions });
    expect(getRuleValueControl(categorical, "isAnyOf")).toBe("multiPicker");
    expect(getRuleValueControl(categorical, "includesOneOf")).toBe("multiPicker");
  });

  test("picks a day for a date", () => {
    expect(getRuleValueControl(property({ valueType: "date" }), "isBefore")).toBe("date");
  });

  test("picks from looked-up values for an exact match, and types text for a partial one", () => {
    const categorical = property({ valueType: "enum", loadOptions });
    expect(getRuleValueControl(categorical, "equals")).toBe("picker");
    expect(getRuleValueControl(categorical, "notEquals")).toBe("picker");
    expect(getRuleValueControl(categorical, "contains")).toBe("text");
  });

  test("always picks from a fixed set of enum values", () => {
    const fixed = property({ valueType: "enum", options: [{ value: "a", label: "A" }] });
    expect(getRuleValueControl(fixed, "equals")).toBe("picker");
    expect(getRuleValueControl(fixed, "contains")).toBe("picker");
  });

  test("picks a free string's looked-up values for an exact match only", () => {
    const attribute = property({ loadOptions });
    expect(getRuleValueControl(attribute, "equals")).toBe("picker");
    expect(getRuleValueControl(attribute, "startsWith")).toBe("text");
  });

  test("types a number for a comparison", () => {
    const seats = property({ valueType: "number", loadOptions });
    expect(getRuleValueControl(seats, "equals")).toBe("picker");
    expect(getRuleValueControl(seats, "greaterThan")).toBe("number");
    expect(getRuleValueControl(property({ valueType: "number" }), "equals")).toBe("number");
  });

  test("keeps seen values as suggestions on a free string, and types text otherwise", () => {
    expect(getRuleValueControl(property({ suggestions: ["a"] }), "contains")).toBe("editor");
    expect(getRuleValueControl(property({}), "contains")).toBe("text");
  });
});
