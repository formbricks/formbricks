import { describe, expect, test } from "vitest";
import { conditionGroupToRules, rulesToConditionGroup } from "./advanced-filter";
import { buildColumnSettings } from "./column-settings";
import { reconcileColumnOrder, reconcileColumnVisibility } from "./column-state";
import { resolveDateFilterBounds } from "./date-filter";
import { resolveEnumFilter } from "./enum-filters";
import { replaceRules, setDateQuickFilter, toggleQuickFilterValue } from "./filter-state";
import type { TFilterProperty, TTableFilter } from "./types";

describe("resolveEnumFilter", () => {
  const all = ["a", "b", "c"] as const;

  test("is null when nothing filters the property", () => {
    expect(resolveEnumFilter([], "x", all)).toBeNull();
  });

  test("intersects quick values and rules", () => {
    const filters: TTableFilter[] = [
      { property: "x", operator: "in", values: ["a", "b"] },
      { property: "x", operator: "notEquals", values: ["a"] },
    ];
    expect(resolveEnumFilter(filters, "x", all)).toEqual(["b"]);
  });

  test("is empty when the filters exclude every value", () => {
    const filters: TTableFilter[] = [
      { property: "x", operator: "equals", values: ["a"] },
      { property: "x", operator: "notEquals", values: ["a"] },
    ];
    expect(resolveEnumFilter(filters, "x", all)).toEqual([]);
  });
});

describe("filter-state", () => {
  test("toggling the last value removes the filter", () => {
    const one = toggleQuickFilterValue([], "x", "a");
    expect(one).toEqual([{ property: "x", operator: "in", values: ["a"] }]);
    expect(toggleQuickFilterValue(one, "x", "a")).toEqual([]);
  });

  test("a date quick filter replaces the previous one on the property", () => {
    const preset = setDateQuickFilter([], "d", { operator: "preset", preset: "last_7_days" });
    const range = setDateQuickFilter(preset, "d", {
      operator: "between",
      from: "2026-01-01",
      to: "2026-01-02",
    });
    expect(range).toEqual([{ property: "d", operator: "between", values: ["2026-01-01", "2026-01-02"] }]);
    expect(setDateQuickFilter(range, "d", null)).toEqual([]);
  });

  test("replaceRules keeps quick filters and swaps every rule", () => {
    const filters: TTableFilter[] = [
      { property: "x", operator: "in", values: ["a"] },
      { property: "n", operator: "greaterThan", values: ["1"] },
    ];
    expect(replaceRules(filters, [{ property: "n", operator: "lessThan", values: ["9"] }])).toEqual([
      { property: "x", operator: "in", values: ["a"] },
      { property: "n", operator: "lessThan", values: ["9"] },
    ]);
  });
});

describe("advanced filter conversion", () => {
  const properties: TFilterProperty[] = [
    { id: "n", label: "N", valueType: "number", ruleOperators: ["greaterThan", "isSet"] },
    { id: "d", label: "D", valueType: "date", ruleOperators: ["isBefore"] },
  ];

  test("round-trips finished rules", () => {
    const rules: TTableFilter[] = [
      { property: "n", operator: "greaterThan", values: ["8"] },
      { property: "n", operator: "isSet", values: [] },
      { property: "d", operator: "isBefore", values: ["2026-10-05"] },
    ];
    expect(conditionGroupToRules(rulesToConditionGroup(rules), properties)).toEqual({
      rules,
      incomplete: [],
    });
  });

  test("drops untouched rows but blocks half-written ones", () => {
    const group = rulesToConditionGroup([]);
    const untouched = group.conditions[0];
    group.conditions.push(
      {
        id: "bad-number",
        leftOperand: { value: "n", type: "property" },
        operator: "greaterThan",
        rightOperand: { value: "x", type: "static" },
      },
      { id: "no-operator", leftOperand: { value: "n", type: "property" }, operator: "" },
      {
        id: "bad-day",
        leftOperand: { value: "d", type: "property" },
        operator: "isBefore",
        rightOperand: { value: "2026-13-01", type: "static" },
      }
    );
    const result = conditionGroupToRules(group, properties);
    expect(result.rules).toEqual([]);
    expect(result.incomplete).toEqual(["bad-number", "no-operator", "bad-day"]);
    expect(result.incomplete).not.toContain(untouched.id);
  });
});

describe("resolveDateFilterBounds", () => {
  const now = new Date("2026-10-26T10:00:00Z");

  test("cuts a preset in the reporting time zone", () => {
    const bounds = resolveDateFilterBounds(
      { property: "d", operator: "preset", values: ["today"] },
      "Asia/Kolkata",
      now
    );
    expect(bounds?.from?.toISOString()).toBe("2026-10-25T18:30:00.000Z");
    expect(bounds?.to?.toISOString()).toBe("2026-10-26T18:29:59.999Z");
  });

  test("covers whole days for a range", () => {
    const bounds = resolveDateFilterBounds(
      { property: "d", operator: "between", values: ["2026-10-01", "2026-10-02"] },
      "UTC",
      now
    );
    expect(bounds?.from?.toISOString()).toBe("2026-10-01T00:00:00.000Z");
    expect(bounds?.to?.toISOString()).toBe("2026-10-02T23:59:59.999Z");
  });

  test("before and after exclude the named day", () => {
    const before = resolveDateFilterBounds(
      { property: "d", operator: "isBefore", values: ["2026-10-05"] },
      "UTC",
      now
    );
    const after = resolveDateFilterBounds(
      { property: "d", operator: "isAfter", values: ["2026-10-05"] },
      "UTC",
      now
    );
    expect(before?.to?.toISOString()).toBe("2026-10-04T23:59:59.999Z");
    expect(after?.from?.toISOString()).toBe("2026-10-06T00:00:00.000Z");
  });

  test("is null for a filter that is not about dates", () => {
    expect(resolveDateFilterBounds({ property: "x", operator: "in", values: ["a"] }, "UTC", now)).toBeNull();
  });
});

describe("column state", () => {
  test("keeps saved order for known columns and appends new ones", () => {
    expect(reconcileColumnOrder(["b", "gone", "a"], ["a", "b", "c"])).toEqual(["b", "a", "c"]);
    expect(reconcileColumnOrder("garbage", ["a", "b"])).toEqual(["a", "b"]);
  });

  test("keeps saved visibility and defaults the rest", () => {
    expect(reconcileColumnVisibility({ a: false, gone: true }, ["a", "b", "c"], { c: false })).toEqual({
      a: false,
      b: true,
      c: false,
    });
  });

  test("locked columns always show and labels follow the order", () => {
    expect(
      buildColumnSettings(
        [
          { id: "a", label: "A" },
          { id: "b", label: "B" },
        ],
        ["b", "select", "a"],
        { a: false, b: false },
        ["a"]
      )
    ).toEqual([
      { id: "b", label: "B", visible: false, locked: false },
      { id: "a", label: "A", visible: true, locked: true },
    ]);
  });
});
