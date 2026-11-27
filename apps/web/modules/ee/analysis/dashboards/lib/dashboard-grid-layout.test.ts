import { describe, expect, test } from "vitest";
import type { TDashboardWidget } from "@/modules/ee/analysis/types/analysis";
import { applyLayoutToWidgets, isEmptyImageBlock, widgetsToLayout } from "./dashboard-grid-layout";
import { GRID_COLUMNS, MAX_WIDGET_HEIGHT } from "./widget-placement";

const layout = { x: 0, y: 0, w: 4, h: 4 };

const chart = (id: string, type = "bar", at = layout): TDashboardWidget =>
  ({
    id,
    kind: "chart",
    chartId: `chart_${id}`,
    dashboardId: "d",
    pageId: "p1",
    layout: at,
    order: 0,
    chart: { type, name: id },
  }) as unknown as TDashboardWidget;

const block = (id: string, kind: "text" | "image" | "separator", content: unknown = {}): TDashboardWidget =>
  ({
    id,
    kind,
    chartId: null,
    dashboardId: "d",
    pageId: "p1",
    layout: { x: 0, y: 0, w: 1, h: 2 },
    order: 0,
    content,
  }) as unknown as TDashboardWidget;

describe("isEmptyImageBlock", () => {
  test("is an image block without a file, and nothing else", () => {
    expect(isEmptyImageBlock(block("i", "image", { fileUrl: null }))).toBe(true);
    expect(isEmptyImageBlock(block("i", "image", { fileUrl: "https://x/y.png" }))).toBe(false);
    expect(isEmptyImageBlock(chart("c"))).toBe(false);
  });
});

describe("widgetsToLayout", () => {
  test("draws a chart saved smaller than the editor allows at its minimum", () => {
    const [item] = widgetsToLayout([chart("c", "bar", { x: 1, y: 2, w: 1, h: 1 })], new Map());
    expect(item).toMatchObject({ i: "c", x: 1, y: 2, w: 2, h: 12, minW: 2, minH: 12 });
    expect(item.maxW).toBe(GRID_COLUMNS);
    expect(item.maxH).toBe(MAX_WIDGET_HEIGHT);
  });

  test("keeps a separator's height and gives it only the side handles", () => {
    const [item] = widgetsToLayout([block("s", "separator")], new Map());
    expect(item).toMatchObject({ h: 2, minH: 2, maxH: 2, resizeHandles: ["e", "w"] });
  });

  test("never lets a text or image block be shorter than its content needs", () => {
    const [measured, unmeasured] = widgetsToLayout(
      [block("t", "text"), block("i", "image")],
      new Map([["t", 5]])
    );
    expect(measured.minH).toBe(5);
    expect(measured.w).toBe(2);
    expect(unmeasured.minH).toBe(1);
  });
});

describe("applyLayoutToWidgets", () => {
  test("returns the same array when nothing moved", () => {
    const widgets = [chart("a"), chart("b")];
    expect(applyLayoutToWidgets(widgets, [{ i: "a", ...layout }])).toBe(widgets);
  });

  test("moves only the widgets the grid moved", () => {
    const widgets = [chart("a"), chart("b")];
    const next = applyLayoutToWidgets(widgets, [{ i: "b", x: 4, y: 0, w: 6, h: 8 }]);
    expect(next).not.toBe(widgets);
    expect(next[0]).toBe(widgets[0]);
    expect(next[1].layout).toEqual({ x: 4, y: 0, w: 6, h: 8 });
  });
});
