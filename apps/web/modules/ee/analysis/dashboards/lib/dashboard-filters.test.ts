import { describe, expect, test } from "vitest";
import {
  MAX_DASHBOARD_FILTERS,
  type TDashboardFilter,
  findDashboardFilterIssues,
  getDashboardFilterField,
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

  test("lists only fields the catalog has a value lookup for: free text is typed", () => {
    expect(isListDashboardFilter(filter(1, { field: "FeedbackRecords.language" }))).toBe(true);
    expect(isListDashboardFilter(filter(1, { field: "FeedbackRecords.valueText" }))).toBe(false);
    expect(isListDashboardFilter(filter(1, { field: "FeedbackRecords.userId" }))).toBe(false);
    expect(isListDashboardFilter(filter(1, { field: "FeedbackRecords.metadataUrl" }))).toBe(false);
  });

  test("free-text fields remain valid filters, typed", () => {
    expect(findDashboardFilterIssues([filter(1, { field: "FeedbackRecords.valueText" })])).toEqual([]);
    expect(findDashboardFilterIssues([filter(1, { field: "FeedbackRecords.userId" })])).toEqual([]);
  });
});

describe("filter-only fields", () => {
  test("the answer filter is not a dashboard filter field", () => {
    expect(getDashboardFilterField("FeedbackRecords.answer")).toBeUndefined();
    expect(getDashboardFilterOperators("FeedbackRecords.answer")).toEqual([]);
    expect(findDashboardFilterIssues([filter(1, { field: "FeedbackRecords.answer" })])).toEqual([
      expect.objectContaining({ path: [0, "field"] }),
    ]);
  });
});

describe("parseStoredDashboardFilters", () => {
  test("reads a stored list, skipping anything malformed, and anything but a list as none", () => {
    expect(parseStoredDashboardFilters([filter(1), { id: "x" }, filter(2)])).toEqual([filter(1), filter(2)]);
    expect(parseStoredDashboardFilters({})).toEqual([]);
    expect(parseStoredDashboardFilters(null)).toEqual([]);
  });
});

describe("embedded-data fields as dashboard filters", () => {
  const plan = "FeedbackRecords.ed_plan_64879f7d";

  test("an embedded member is a text dimension filtered like any text field, and picks from a list", () => {
    expect(getDashboardFilterField(plan)).toMatchObject({ name: plan, kind: "dimension", type: "string" });
    expect(getDashboardFilterOperators(plan)).toEqual(["equals", "notEquals", "contains", "notContains"]);
    expect(isListDashboardFilter(filter(1, { field: plan }))).toBe(true);
    expect(isListDashboardFilter(filter(1, { field: plan, operator: "contains" }))).toBe(false);
  });

  test("saves a filter on an embedded member, and refuses a name that only looks like one", () => {
    expect(findDashboardFilterIssues([filter(1, { field: plan })])).toEqual([]);
    expect(findDashboardFilterIssues([filter(1, { field: "FeedbackRecords.ed_Plan!" })])).toEqual([
      expect.objectContaining({ path: [0, "field"] }),
    ]);
    expect(findDashboardFilterIssues([filter(1, { field: plan, operator: "gt" })])).toEqual([
      expect.objectContaining({ path: [0, "operator"] }),
    ]);
  });
});
