import { describe, expect, test } from "vitest";
import {
  MAX_DASHBOARD_FILTERS,
  type TDashboardFilter,
  findDashboardFilterIssues,
  getDashboardFilterOperators,
  isListDashboardFilter,
  parseStoredDashboardFilters,
} from "./dashboard-filters";

const filter = (n: number, overrides: Partial<TDashboardFilter> = {}): TDashboardFilter => ({
  id: `clfi${String(n).padStart(21, "0")}`,
  field: "FeedbackRecords.sourceName",
  operator: "equals",
  label: `Filter ${n}`,
  ...overrides,
});

describe("findDashboardFilterIssues", () => {
  test("accepts no filters and exactly the cap", () => {
    expect(findDashboardFilterIssues([])).toEqual([]);
    expect(
      findDashboardFilterIssues(Array.from({ length: MAX_DASHBOARD_FILTERS }, (_, i) => filter(i)))
    ).toEqual([]);
  });

  test("refuses one over the cap", () => {
    const issues = findDashboardFilterIssues(
      Array.from({ length: MAX_DASHBOARD_FILTERS + 1 }, (_, i) => filter(i))
    );
    expect(issues).toEqual([{ path: [], message: "A dashboard holds at most 10 filters." }]);
  });

  test("names an unknown field, a measure, an operator the field does not allow, and a repeated id", () => {
    expect(
      findDashboardFilterIssues([
        filter(1, { field: "FeedbackRecords.nope" }),
        filter(2, { field: "FeedbackRecords.npsScore" }),
        filter(3, { field: "FeedbackRecords.language", operator: "gt" }),
        filter(3),
      ]).map((issue) => issue.path)
    ).toEqual([
      [0, "field"],
      [1, "field"],
      [2, "operator"],
      [3, "id"],
    ]);
  });
});

describe("getDashboardFilterOperators", () => {
  test("offers the catalog's operators that take a value, and none for an unknown field", () => {
    expect(getDashboardFilterOperators("FeedbackRecords.sourceName")).toEqual([
      "equals",
      "notEquals",
      "contains",
      "notContains",
    ]);
    expect(getDashboardFilterOperators("FeedbackRecords.collectedAt")).toEqual([
      "equals",
      "notEquals",
      "gt",
      "gte",
      "lt",
      "lte",
    ]);
    expect(getDashboardFilterOperators("FeedbackRecords.nope")).toEqual([]);
  });
});

describe("isListDashboardFilter", () => {
  test("is a list for equals and notEquals on a text field only", () => {
    expect(isListDashboardFilter(filter(1))).toBe(true);
    expect(isListDashboardFilter(filter(1, { operator: "notEquals" }))).toBe(true);
    expect(isListDashboardFilter(filter(1, { operator: "contains" }))).toBe(false);
    expect(isListDashboardFilter(filter(1, { field: "FeedbackRecords.collectedAt" }))).toBe(false);
  });
});

describe("parseStoredDashboardFilters", () => {
  test("reads a stored list, skipping anything malformed, and anything but a list as none", () => {
    expect(parseStoredDashboardFilters([filter(1), { id: "x" }, filter(2)])).toEqual([filter(1), filter(2)]);
    expect(parseStoredDashboardFilters({})).toEqual([]);
    expect(parseStoredDashboardFilters(null)).toEqual([]);
  });
});
