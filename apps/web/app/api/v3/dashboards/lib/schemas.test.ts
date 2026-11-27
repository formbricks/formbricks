import { describe, expect, test } from "vitest";
import { MAX_DASHBOARD_FILTERS } from "@/modules/ee/analysis/dashboards/lib/dashboard-filters";
import {
  MAX_DASHBOARD_WIDGETS,
  MAX_WIDGETS_PER_WRITE,
  ZDashboardFilterPicks,
  ZV3DashboardChartDataQuery,
  ZV3DashboardFilterValuesQuery,
  ZV3DashboardFilters,
  ZV3DashboardReplaceBody,
} from "./schemas";

const body = (widgets: { widgetId: string; order: number }[]) => ({
  name: "Board",
  expectedUpdatedAt: "2026-10-26T10:00:00.000Z",
  widgets: widgets.map((widget, index) => ({
    ...widget,
    // Four to a row, so even the largest write stays inside the grid's 1000 rows.
    layout: { x: (index % 4) * 3, y: Math.floor(index / 4) * 2, w: 3, h: 2 },
  })),
});

describe("ZV3DashboardReplaceBody", () => {
  test("takes back a stored order past the widget count, as adds and removals leave them", () => {
    // Adds take the highest order plus one and removals never renumber, so a long-lived dashboard holds these.
    const parsed = ZV3DashboardReplaceBody.safeParse(
      body([
        { widgetId: "clwg000000000000000000001", order: MAX_DASHBOARD_WIDGETS + 150 },
        { widgetId: "clwg000000000000000000002", order: 9_999 },
      ])
    );
    expect(parsed.success).toBe(true);
  });

  test("still refuses a negative, fractional or out-of-column order, and the old updatedAt name", () => {
    for (const order of [-1, 1.5, 2_147_483_648]) {
      expect(
        ZV3DashboardReplaceBody.safeParse(body([{ widgetId: "clwg000000000000000000001", order }])).success
      ).toBe(false);
    }
    const { expectedUpdatedAt, ...rest } = body([]);
    expect(ZV3DashboardReplaceBody.safeParse({ ...rest, updatedAt: expectedUpdatedAt }).success).toBe(false);
  });

  test("carries a dashboard that grew past the add cap before it existed, up to the request bound", () => {
    const widgets = (count: number) =>
      Array.from({ length: count }, (_, index) => ({
        widgetId: `clwg${String(index).padStart(21, "0")}`,
        order: index,
      }));

    expect(ZV3DashboardReplaceBody.safeParse(body(widgets(MAX_DASHBOARD_WIDGETS + 10))).success).toBe(true);
    expect(ZV3DashboardReplaceBody.safeParse(body(widgets(MAX_WIDGETS_PER_WRITE))).success).toBe(true);
    expect(ZV3DashboardReplaceBody.safeParse(body(widgets(MAX_WIDGETS_PER_WRITE + 1))).success).toBe(false);
  });
});

describe("ZV3DashboardReplaceBody filters (ENG-7061)", () => {
  const filter = (overrides: Record<string, unknown> = {}) => ({
    id: "clfi000000000000000000001",
    field: "FeedbackRecords.sourceName",
    operator: "equals",
    label: "Source",
    values: ["Web"],
    ...overrides,
  });

  test("leaves the catalog checks to the operation, so they answer 422 rather than 400", () => {
    // An operator the field refuses, a field outside the catalog, a repeated id: each is well-shaped.
    for (const filters of [
      [filter({ operator: "gt" })],
      [filter({ field: "FeedbackRecords.notAField" })],
      [filter(), filter({ label: "Again" })],
    ]) {
      expect(ZV3DashboardReplaceBody.safeParse({ ...body([]), filters }).success).toBe(true);
    }
  });

  test("still refuses a filters value that is not a list, or more than the cap, with 400", () => {
    expect(ZV3DashboardReplaceBody.safeParse({ ...body([]), filters: "x" }).success).toBe(false);
    const tooMany = Array.from({ length: MAX_DASHBOARD_FILTERS + 1 }, (_, index) =>
      filter({ id: `clfi${String(index).padStart(21, "0")}` })
    );
    expect(ZV3DashboardReplaceBody.safeParse({ ...body([]), filters: tooMany }).success).toBe(false);
  });
});

describe("dashboard filter picks (C6, C15)", () => {
  const A = "f1";

  test("one exported picks schema: a filter id to one to 100 values of up to 1000 characters", () => {
    expect(ZDashboardFilterPicks.safeParse({ [A]: ["Web", "App"] }).success).toBe(true);
    expect(ZDashboardFilterPicks.safeParse({ [A]: [] }).success).toBe(false);
    expect(ZDashboardFilterPicks.safeParse({ [A]: Array.from({ length: 101 }, () => "x") }).success).toBe(
      false
    );
    expect(ZDashboardFilterPicks.safeParse({ [A]: ["x".repeat(1001)] }).success).toBe(false);
    expect(ZDashboardFilterPicks.safeParse({ "not an id": ["x"] }).success).toBe(false);
  });

  test("refuses a NUL byte in a pick value and in a value-list search", () => {
    expect(ZDashboardFilterPicks.safeParse({ [A]: ["We\u0000b"] }).success).toBe(false);
    expect(ZV3DashboardChartDataQuery.safeParse({ [`picks[${A}]`]: "We\u0000b" }).success).toBe(false);
    expect(ZV3DashboardFilterValuesQuery.safeParse({ search: "a\u0000" }).success).toBe(false);
    expect(ZV3DashboardFilterValuesQuery.safeParse({ search: "web" }).success).toBe(true);
  });

  test("refuses a NUL byte in a filter label", () => {
    expect(
      ZV3DashboardFilters.safeParse([
        {
          id: "clfi000000000000000000001",
          field: "FeedbackRecords.sourceName",
          operator: "equals",
          label: "So\u0000urce",
        },
      ]).success
    ).toBe(false);
  });
});
