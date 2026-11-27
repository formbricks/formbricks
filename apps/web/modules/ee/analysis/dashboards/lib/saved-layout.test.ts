import { describe, expect, test } from "vitest";
import type { TDashboardWidget } from "@/modules/ee/analysis/types/analysis";
import { compactWidgetLayouts } from "./saved-layout";

const widget = (id: string, pageId: string, y: number, h: number): TDashboardWidget =>
  ({
    id,
    kind: "text",
    dashboardId: "d",
    pageId,
    order: 0,
    content: { headline: id, description: "" },
    layout: { x: 0, y, w: 6, h },
  }) as TDashboardWidget;

describe("compactWidgetLayouts", () => {
  test("pushes a widget below a grown block down instead of saving the overlap", () => {
    const widgets = [widget("a", "p1", 0, 4), widget("b", "p1", 2, 2)];
    const compacted = compactWidgetLayouts(widgets);
    expect(compacted.map((w) => [w.id, w.layout.y, w.layout.h])).toEqual([
      ["a", 0, 4],
      ["b", 4, 2],
    ]);
  });

  test("compacts each page on its own", () => {
    const widgets = [widget("a", "p1", 0, 4), widget("b", "p2", 0, 2)];
    expect(compactWidgetLayouts(widgets)).toBe(widgets);
  });

  test("returns the same array when nothing moves", () => {
    const widgets = [widget("a", "p1", 0, 2), widget("b", "p1", 2, 2)];
    expect(compactWidgetLayouts(widgets)).toBe(widgets);
  });
});
