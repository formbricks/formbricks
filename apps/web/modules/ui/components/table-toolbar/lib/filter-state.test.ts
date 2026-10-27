import { describe, expect, test } from "vitest";
import { getFixedValues, getRules, removeFilterAt, toggleQuickFilterValue } from "./filter-state";
import type { TTableFilter } from "./types";

const quick: TTableFilter = { property: "status", operator: "in", values: ["draft"] };
const rule: TTableFilter = { property: "name", operator: "contains", values: ["nps"] };

describe("toggleQuickFilterValue", () => {
  test("starts a quick filter when the property has none", () => {
    expect(toggleQuickFilterValue([rule], "status", "draft")).toEqual([rule, quick]);
  });

  test("adds a value to the existing quick filter in place", () => {
    expect(toggleQuickFilterValue([quick, rule], "status", "inProgress")).toEqual([
      { ...quick, values: ["draft", "inProgress"] },
      rule,
    ]);
  });
});

describe("removeFilterAt", () => {
  test("removes only the chip at that position", () => {
    expect(removeFilterAt([quick, rule], 0)).toEqual([rule]);
  });
});

describe("getRules", () => {
  test("keeps the Advanced filter rules and drops quick filters", () => {
    const range: TTableFilter = {
      property: "createdAt",
      operator: "between",
      values: ["2026-01-01", "2026-01-31"],
    };
    expect(getRules([quick, rule, range])).toEqual([rule]);
  });
});

describe("ticking every value of a fixed list", () => {
  const statuses = ["draft", "inProgress", "paused", "completed"];

  test("removes the filter, so 'any status' pages like no filter", () => {
    const filters: TTableFilter[] = [{ property: "status", operator: "in", values: statuses.slice(0, 3) }];
    expect(toggleQuickFilterValue(filters, "status", "completed", statuses)).toEqual([]);
  });

  test("keeps a partial selection, and lists loaded on demand never count as complete", () => {
    expect(toggleQuickFilterValue([], "status", "draft", statuses)).toEqual([
      { property: "status", operator: "in", values: ["draft"] },
    ]);
    expect(toggleQuickFilterValue([], "source", "csv", undefined)).toEqual([
      { property: "source", operator: "in", values: ["csv"] },
    ]);
  });

  test("leaves hidden switches and one-value lists alone", () => {
    expect(
      getFixedValues({
        id: "archived",
        label: "Archived",
        valueType: "enum",
        hidden: true,
        options: [{ value: "true", label: "x" }],
      })
    ).toBeUndefined();
    expect(
      getFixedValues({
        id: "flag",
        label: "Flag",
        valueType: "enum",
        options: [{ value: "on", label: "On" }],
      })
    ).toBeUndefined();
  });
});
