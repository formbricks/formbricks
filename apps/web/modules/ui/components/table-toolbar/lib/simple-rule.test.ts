import { describe, expect, test } from "vitest";
import { replaceFilterAt } from "./filter-state";
import {
  draftFromRule,
  draftToRule,
  getPopoverValueControl,
  groupFilterProperties,
  isMenuProperty,
  searchMenuProperties,
  startsRule,
  switchDraftOperator,
} from "./simple-rule";
import type { TFilterProperty } from "./types";

const country: TFilterProperty = {
  id: "country",
  label: "Country",
  valueType: "string",
  group: "Embedded data",
  ruleOperators: ["equals", "notEquals", "contains", "isAnyOf", "isNoneOf", "isSet"],
  loadOptions: async () => ({ options: [], hasMore: false }),
};
const score: TFilterProperty = {
  id: "score",
  label: "Score",
  valueType: "number",
  ruleOperators: ["greaterThan", "lessThan", "isSet"],
};
const sentiment: TFilterProperty = {
  id: "sentiment",
  label: "Sentiment",
  valueType: "enum",
  quick: true,
  group: "AI",
  options: [{ label: "Positive", value: "positive" }],
};
const tags: TFilterProperty = {
  id: "tags",
  label: "Tags",
  valueType: "string",
  ruleOperators: ["includesOneOf"],
  options: [{ label: "Bug", value: "bug" }],
};
const archived: TFilterProperty = { id: "archived", label: "Archived", valueType: "enum", hidden: true };
const nothing: TFilterProperty = { id: "nothing", label: "Nothing", valueType: "string" };

describe("menu properties", () => {
  test("lists quick and rule properties, never hidden or unfilterable ones", () => {
    expect([country, score, sentiment, archived, nothing].filter(isMenuProperty)).toEqual([
      country,
      score,
      sentiment,
    ]);
  });

  test("only a property without a quick filter starts a rule", () => {
    expect(startsRule(country)).toBe(true);
    expect(startsRule(sentiment)).toBe(false);
    expect(startsRule({ ...sentiment, ruleOperators: ["equals"] })).toBe(false);
  });

  test("search matches the label or the group, ignoring case and spaces", () => {
    const all = [country, score, sentiment];
    expect(searchMenuProperties(all, "  sco ")).toEqual([score]);
    expect(searchMenuProperties(all, "EMBEDDED")).toEqual([country]);
    expect(searchMenuProperties(all, "")).toEqual(all);
    expect(searchMenuProperties(all, "zzz")).toEqual([]);
  });

  test("groups keep the order each group is first named, ungrouped under the default", () => {
    expect(groupFilterProperties([sentiment, country, score, tags], "Properties")).toEqual([
      { label: "AI", properties: [sentiment] },
      { label: "Embedded data", properties: [country] },
      { label: "Properties", properties: [score, tags] },
    ]);
  });
});

describe("rule drafts", () => {
  test("a new draft starts on the property's first operator", () => {
    expect(draftFromRule(country)).toEqual({ operator: "equals", value: "", values: [] });
  });

  test("an existing rule opens with its operator and values", () => {
    expect(
      draftFromRule(country, { property: "country", operator: "isAnyOf", values: ["DE", "FR"] })
    ).toEqual({ operator: "isAnyOf", value: "", values: ["DE", "FR"] });
    expect(draftFromRule(score, { property: "score", operator: "greaterThan", values: ["5"] })).toEqual({
      operator: "greaterThan",
      value: "5",
      values: [],
    });
  });

  test("an unfinished draft is no rule", () => {
    expect(draftToRule(country, { operator: "equals", value: "  ", values: [] })).toBeNull();
    expect(draftToRule(country, { operator: "isAnyOf", value: "", values: [] })).toBeNull();
    expect(draftToRule(score, { operator: "greaterThan", value: "abc", values: [] })).toBeNull();
    expect(draftToRule(country, { operator: "", value: "DE", values: [] })).toBeNull();
    expect(draftToRule(country, { operator: "startsWith", value: "DE", values: [] })).toBeNull();
  });

  test("a finished draft is its rule", () => {
    expect(draftToRule(country, { operator: "equals", value: " DE ", values: [] })).toEqual({
      property: "country",
      operator: "equals",
      values: ["DE"],
    });
    expect(draftToRule(country, { operator: "isNoneOf", value: "", values: ["DE", "DE", "FR"] })).toEqual({
      property: "country",
      operator: "isNoneOf",
      values: ["DE", "FR"],
    });
    expect(draftToRule(country, { operator: "isSet", value: "", values: [] })).toEqual({
      property: "country",
      operator: "isSet",
      values: [],
    });
  });

  test("switching operator keeps the value only while the control stays the same", () => {
    const single = { operator: "equals" as const, value: "DE", values: [] };
    expect(switchDraftOperator(country, single, "notEquals")).toEqual({ ...single, operator: "notEquals" });
    expect(switchDraftOperator(country, single, "contains")).toEqual({
      operator: "contains",
      value: "",
      values: [],
    });
    const list = { operator: "isAnyOf" as const, value: "", values: ["DE"] };
    expect(switchDraftOperator(country, list, "isNoneOf")).toEqual({ ...list, operator: "isNoneOf" });
  });

  test("the popover draws a control wherever the dialog would fall back to its own combobox", () => {
    expect(getPopoverValueControl(tags, "includesOneOf")).toBe("multiPicker");
    expect(getPopoverValueControl({ ...score, valueType: "string", suggestions: ["a"] }, "greaterThan")).toBe(
      "text"
    );
    expect(getPopoverValueControl(country, "isAnyOf")).toBe("multiPicker");
    expect(getPopoverValueControl(score, "greaterThan")).toBe("number");
  });
});

describe("replaceFilterAt", () => {
  test("swaps only the filter at the index", () => {
    const a = { property: "a", operator: "isSet" as const, values: [] };
    const b = { property: "b", operator: "isSet" as const, values: [] };
    const c = { property: "c", operator: "isNotSet" as const, values: [] };
    expect(replaceFilterAt([a, b], 1, c)).toEqual([a, c]);
  });
});
