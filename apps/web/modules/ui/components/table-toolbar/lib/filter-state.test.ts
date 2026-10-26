import { describe, expect, test } from "vitest";
import { getRules, removeFilterAt, toggleQuickFilterValue } from "./filter-state";
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
