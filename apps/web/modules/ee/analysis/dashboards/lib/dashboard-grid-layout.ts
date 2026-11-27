import type { Layout, LayoutItem } from "react-grid-layout";
import { resolveChartType } from "@/modules/ee/analysis/charts/lib/chart-utils";
import type { TDashboardWidget } from "@/modules/ee/analysis/types/analysis";
import { getBlockMinSize } from "./widget-blocks";
import { GRID_COLUMNS, MAX_WIDGET_HEIGHT, getWidgetMinSize } from "./widget-placement";

// Rows are 8px with 16px between them, so a unit is 24px: fine enough for a block to fit its content
// (4 units are what one 80px row was).
export const ROW_HEIGHT = 8;
export const GRID_MARGIN = 16;

/** An image block without a file: a placeholder for editors, not drawn for viewers. */
export const isEmptyImageBlock = (widget: TDashboardWidget): boolean =>
  widget.kind === "image" && widget.content.fileUrl === null;

const SIDE_RESIZE_HANDLES: LayoutItem["resizeHandles"] = ["e", "w"];

/** The grid's layout for the widgets, with each one's size limits and the rows its content needs. */
export const widgetsToLayout = (
  widgets: TDashboardWidget[],
  neededRows: ReadonlyMap<string, number>
): LayoutItem[] =>
  widgets.map((widget) => {
    const minSize =
      widget.kind === "chart"
        ? getWidgetMinSize(resolveChartType(widget.chart.type))
        : getBlockMinSize(widget.kind);
    return {
      i: widget.id,
      x: widget.layout.x,
      y: widget.layout.y,
      w: Math.max(widget.layout.w, minSize.minW),
      // The API and MCP tools take any size; a chart saved smaller than the editor allows is drawn at its
      // minimum, so it stays readable (the next save keeps that size).
      h: widget.kind === "chart" ? Math.max(widget.layout.h, minSize.minH) : widget.layout.h,
      ...minSize,
      maxW: GRID_COLUMNS,
      // A separator keeps its height, so a resize only changes its width and it only gets the side
      // handles. An image or text block can be made taller to line up with its neighbours, never shorter
      // than its content.
      ...(widget.kind === "separator"
        ? { minH: widget.layout.h, maxH: widget.layout.h, resizeHandles: SIDE_RESIZE_HANDLES }
        : {
            maxH: MAX_WIDGET_HEIGHT,
            ...(widget.kind === "chart" ? {} : { minH: neededRows.get(widget.id) ?? minSize.minH }),
          }),
    };
  });

/** The widgets moved to where the grid left them; the same array when nothing moved. */
export const applyLayoutToWidgets = (widgets: TDashboardWidget[], newLayout: Layout): TDashboardWidget[] => {
  let changed = false;
  const updated = widgets.map((widget) => {
    const layoutItem = newLayout.find((l) => l.i === widget.id);
    if (!layoutItem) return widget;

    if (
      widget.layout.x === layoutItem.x &&
      widget.layout.y === layoutItem.y &&
      widget.layout.w === layoutItem.w &&
      widget.layout.h === layoutItem.h
    ) {
      return widget;
    }

    changed = true;
    return {
      ...widget,
      layout: { x: layoutItem.x, y: layoutItem.y, w: layoutItem.w, h: layoutItem.h },
    };
  });

  return changed ? updated : widgets;
};
