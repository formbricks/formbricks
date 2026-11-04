import { describe, expect, test } from "vitest";
import {
  decodeFilterRule,
  encodeFilterRule,
  filterRuleIdOf,
  resolveFilterRules,
  toRequestFilters,
} from "./dashboard-filter-rules";

describe("encodeFilterRule and decodeFilterRule", () => {
  test("round-trip an operator and a field", () => {
    const rule = { field: "FeedbackRecords.sourceName", operator: "notEquals" as const };
    expect(encodeFilterRule(rule)).toBe("notEquals:FeedbackRecords.sourceName");
    expect(decodeFilterRule("f1", encodeFilterRule(rule))).toEqual({
      id: "f1",
      ...rule,
      label: rule.field,
    });
  });

  test("refuses what is not <operator>:<field>", () => {
    expect(decodeFilterRule("f1", "FeedbackRecords.sourceName")).toBeNull();
    expect(decodeFilterRule("f1", ":FeedbackRecords.sourceName")).toBeNull();
    expect(decodeFilterRule("f1", "equals:")).toBeNull();
    expect(decodeFilterRule("f1", "startsWith:FeedbackRecords.sourceName")).toBeNull();
  });
});

describe("filterRuleIdOf", () => {
  test("reads the id of a filter[<id>] parameter, and nothing from any other", () => {
    expect(filterRuleIdOf("filter[f2]")).toBe("f2");
    expect(filterRuleIdOf("picks[f2]")).toBeNull();
    expect(filterRuleIdOf("dateRange")).toBeNull();
  });
});

describe("resolveFilterRules", () => {
  test("turns valid definitions into filters, in order", () => {
    const { filters, issues } = resolveFilterRules({
      f1: "equals:FeedbackRecords.sourceName",
      f2: "gt:FeedbackRecords.valueNumber",
    });
    expect(issues).toEqual([]);
    expect(filters.map(({ id, field, operator }) => [id, field, operator])).toEqual([
      ["f1", "FeedbackRecords.sourceName", "equals"],
      ["f2", "FeedbackRecords.valueNumber", "gt"],
    ]);
  });

  test("accepts an embedded-data field", () => {
    expect(resolveFilterRules({ f1: "equals:FeedbackRecords.ed_region" }).issues).toEqual([]);
  });

  test("names each filter that is malformed, outside the catalog or given an operator its field refuses", () => {
    const { issues } = resolveFilterRules({
      f1: "nonsense",
      f2: "equals:FeedbackRecords.notAField",
      f3: "gt:FeedbackRecords.sourceName",
      f4: "equals:FeedbackRecords.count",
    });
    expect(issues.map(({ name }) => name).sort()).toEqual([
      "filter[f1]",
      "filter[f2]",
      "filter[f3]",
      "filter[f4]",
    ]);
  });

  test("no filters is fine", () => {
    expect(resolveFilterRules(undefined)).toEqual({ filters: [], issues: [] });
  });
});

describe("toRequestFilters", () => {
  test("numbers the filters in order and picks only the ones with values", () => {
    expect(
      toRequestFilters([
        { field: "FeedbackRecords.sourceName", operator: "equals", values: ["Web", "App"] },
        { field: "FeedbackRecords.valueNumber", operator: "gt" },
        { field: "FeedbackRecords.metadataDevice", operator: "equals", values: ["", " "] },
      ])
    ).toEqual({
      rules: {
        f1: "equals:FeedbackRecords.sourceName",
        f2: "gt:FeedbackRecords.valueNumber",
        f3: "equals:FeedbackRecords.metadataDevice",
      },
      picks: { f1: ["Web", "App"] },
    });
  });
});
