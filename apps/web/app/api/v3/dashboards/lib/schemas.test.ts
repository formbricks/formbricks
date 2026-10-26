import { describe, expect, test } from "vitest";
import { MAX_DASHBOARD_WIDGETS, ZV3DashboardReplaceBody } from "./schemas";

const body = (widgets: { widgetId: string; order: number }[]) => ({
  name: "Board",
  expectedUpdatedAt: "2026-10-26T10:00:00.000Z",
  widgets: widgets.map((widget, index) => ({ ...widget, layout: { x: 0, y: index * 2, w: 4, h: 2 } })),
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
});
