import { verticalCompactor } from "react-grid-layout";
import type { LayoutItem } from "react-grid-layout";
import type { TDashboardWidget } from "@/modules/ee/analysis/types/analysis";
import { GRID_COLUMNS } from "./widget-placement";

/**
 * The widgets placed as the grid draws them: each page's layout run through the grid's own vertical
 * compactor. A text or image block that grew to fit its content overlaps the widget below it until the
 * grid pushes that one down on screen; the save sends these places, so it never carries the overlap the
 * API refuses. Returns the same array when nothing moves.
 */
export const compactWidgetLayouts = <T extends TDashboardWidget>(widgets: T[]): T[] => {
  const byPage = new Map<string, LayoutItem[]>();
  for (const widget of widgets) {
    const items = byPage.get(widget.pageId) ?? [];
    items.push({ i: widget.id, ...widget.layout });
    byPage.set(widget.pageId, items);
  }
  const placed = new Map<string, LayoutItem>();
  for (const items of byPage.values()) {
    for (const item of verticalCompactor.compact(items, GRID_COLUMNS)) placed.set(item.i, item);
  }
  let changed = false;
  const compacted = widgets.map((widget) => {
    const item = placed.get(widget.id);
    if (
      !item ||
      (item.x === widget.layout.x &&
        item.y === widget.layout.y &&
        item.w === widget.layout.w &&
        item.h === widget.layout.h)
    ) {
      return widget;
    }
    changed = true;
    return { ...widget, layout: { x: item.x, y: item.y, w: item.w, h: item.h } };
  });
  return changed ? compacted : widgets;
};
