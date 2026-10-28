import { describe, expect, test } from "vitest";
import { MAX_DASHBOARD_WIDGETS, MAX_WIDGETS_PER_WRITE, ZV3DashboardReplaceBody } from "./schemas";

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
