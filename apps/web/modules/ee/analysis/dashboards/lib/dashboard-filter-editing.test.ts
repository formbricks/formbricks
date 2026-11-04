import { describe, expect, test } from "vitest";
import {
  applyDashboardFilterPick,
  formatFilterLabels,
  getEditableFilterChipValue,
  reorderDashboardFilters,
  saveDashboardFilterAt,
  summarizePickedValues,
  toTypedPick,
  withoutOwnPick,
} from "./dashboard-filter-editing";
import { MAX_DASHBOARD_FILTER_PICKS_CHARS } from "./dashboard-filter-picks";
import type { TDashboardFilter } from "./dashboard-filters";

const SOURCE: TDashboardFilter = {
  id: "clfi000000000000000000001",
  field: "FeedbackRecords.sourceName",
  operator: "equals",
  label: "Source",
};
const COUNTRY: TDashboardFilter = {
  id: "clfi000000000000000000002",
  field: "FeedbackRecords.metadataCountry",
  operator: "equals",
  label: "Country",
};
const ANSWER: TDashboardFilter = {
  id: "clfi000000000000000000003",
  field: "FeedbackRecords.valueText",
  operator: "contains",
  label: "Answer",
};

describe("reorderDashboardFilters", () => {
  test("moves the dragged filter to where it was dropped, either way", () => {
    const filters = [SOURCE, COUNTRY, ANSWER];
    expect(reorderDashboardFilters(filters, ANSWER.id, SOURCE.id)).toEqual([ANSWER, SOURCE, COUNTRY]);
    expect(reorderDashboardFilters(filters, SOURCE.id, ANSWER.id)).toEqual([COUNTRY, ANSWER, SOURCE]);
  });

  test("leaves the list as it is for a drop on itself or on something that is not a filter", () => {
    const filters = [SOURCE, COUNTRY];
    expect(reorderDashboardFilters(filters, SOURCE.id, SOURCE.id)).toEqual(filters);
    expect(reorderDashboardFilters(filters, SOURCE.id, "nowhere")).toEqual(filters);
    expect(reorderDashboardFilters([], SOURCE.id, COUNTRY.id)).toEqual([]);
  });

  test("keeps every filter of the largest dashboard", () => {
    const filters = Array.from({ length: 10 }, (_, index) => ({
      ...SOURCE,
      id: `clfi0000000000000000000${String(index).padStart(2, "0")}`,
    }));
    const moved = reorderDashboardFilters(filters, filters[9].id, filters[0].id);
    expect(moved.map(({ id }) => id)).toEqual([filters[9], ...filters.slice(0, 9)].map(({ id }) => id));
  });
});

describe("saveDashboardFilterAt", () => {
  test("replaces an edited filter and moves it to the position chosen", () => {
    const renamed = { ...COUNTRY, label: "Land" };
    expect(saveDashboardFilterAt([SOURCE, COUNTRY, ANSWER], renamed, 0)).toEqual([renamed, SOURCE, ANSWER]);
    expect(saveDashboardFilterAt([SOURCE, COUNTRY, ANSWER], renamed, 2)).toEqual([SOURCE, ANSWER, renamed]);
  });

  test("keeps the place when the position did not change", () => {
    const renamed = { ...COUNTRY, label: "Land" };
    expect(saveDashboardFilterAt([SOURCE, COUNTRY, ANSWER], renamed, 1)).toEqual([SOURCE, renamed, ANSWER]);
  });

  test("appends a new filter, clamping an out-of-range position", () => {
    expect(saveDashboardFilterAt([SOURCE], COUNTRY, 99)).toEqual([SOURCE, COUNTRY]);
    expect(saveDashboardFilterAt([], COUNTRY, -3)).toEqual([COUNTRY]);
  });

  test("works on the largest dashboard without losing a filter", () => {
    const filters = Array.from({ length: 10 }, (_, index) => ({
      ...SOURCE,
      id: `clfi0000000000000000000${String(index).padStart(2, "0")}`,
    }));
    const moved = saveDashboardFilterAt(filters, filters[9], 0);
    expect(moved).toHaveLength(10);
    expect(moved[0]).toBe(filters[9]);
    expect(new Set(moved.map(({ id }) => id)).size).toBe(10);
  });
});

describe("withoutOwnPick", () => {
  test("narrows a filter's value list by every other pick, never its own", () => {
    expect(withoutOwnPick({ [SOURCE.id]: ["Web"], [COUNTRY.id]: ["IT"] }, SOURCE.id)).toEqual({
      [COUNTRY.id]: ["IT"],
    });
    expect(withoutOwnPick({}, SOURCE.id)).toEqual({});
  });
});

describe("toTypedPick", () => {
  test("trims a typed value, and an empty one clears the pick", () => {
    expect(toTypedPick("  late delivery ")).toEqual(["late delivery"]);
    expect(toTypedPick("   ")).toEqual([]);
  });
});

describe("summarizePickedValues", () => {
  test("shows one or two values, and the first plus a count beyond that", () => {
    expect(summarizePickedValues([])).toBe("");
    expect(summarizePickedValues(["A"])).toBe("A");
    expect(summarizePickedValues(["A", "B"])).toBe("A, B");
    expect(summarizePickedValues(["A", "B", "C", "D"])).toBe("A +3");
  });
});

describe("applyDashboardFilterPick", () => {
  test("sets one filter's values, drops empty picks and picks for filters the dashboard no longer has", () => {
    expect(
      applyDashboardFilterPick([SOURCE, COUNTRY], { [COUNTRY.id]: ["IT"], gone: ["x"] }, SOURCE.id, ["Web"])
    ).toEqual({ picks: { [SOURCE.id]: ["Web"], [COUNTRY.id]: ["IT"] } });
    expect(applyDashboardFilterPick([SOURCE], { [SOURCE.id]: ["Web"] }, SOURCE.id, [])).toEqual({
      picks: {},
    });
  });

  test("refuses a pick that would take the picks past their total budget, at the boundary", () => {
    const half = "x".repeat(MAX_DASHBOARD_FILTER_PICKS_CHARS / 2);
    const atBudget = applyDashboardFilterPick([SOURCE, COUNTRY], { [COUNTRY.id]: [half] }, SOURCE.id, [half]);
    expect(atBudget).toEqual({ picks: { [SOURCE.id]: [half], [COUNTRY.id]: [half] } });

    const overBudget = applyDashboardFilterPick([SOURCE, COUNTRY], { [COUNTRY.id]: [half] }, SOURCE.id, [
      `${half}y`,
    ]);
    expect(overBudget).toEqual({ exceedsBudget: true });
  });

  test("still lets a person clear or shrink a pick while over budget", () => {
    const big = "x".repeat(MAX_DASHBOARD_FILTER_PICKS_CHARS + 10);
    expect(applyDashboardFilterPick([SOURCE], { [SOURCE.id]: [big] }, SOURCE.id, [])).toEqual({ picks: {} });
  });
});

describe("formatFilterLabels", () => {
  test("joins filter labels as the app's language lists them", () => {
    expect(formatFilterLabels(["Plan"], "en-US")).toBe("Plan");
    expect(formatFilterLabels(["Plan", "Tier"], "en-US")).toBe("Plan and Tier");
    expect(formatFilterLabels(["Plan", "Tier", "Region"], "en-US")).toBe("Plan, Tier, and Region");
    expect(formatFilterLabels(["Plan", "Tier"], "de-DE")).toBe("Plan und Tier");
  });

  test("has nothing to say for no labels", () => {
    expect(formatFilterLabels([], "en-US")).toBe("");
  });
});

describe("getEditableFilterChipValue", () => {
  test("names the field and the operator once the field can be named", () => {
    expect(getEditableFilterChipValue("Source", "equals")).toBe("Source equals");
  });

  test("shows the operator alone while the field's name loads, never an empty pill", () => {
    expect(getEditableFilterChipValue(undefined, "equals")).toBe("equals");
  });
});
