import { TWidgetLayout, ZWidgetLayout } from "@formbricks/types/analysis";
import type { TChartType } from "@/modules/ee/analysis/types/analysis";

/** Columns of the `lg` breakpoint, the one the stored layouts are expressed in. */
export const GRID_COLUMNS = 12;

/** The tallest a widget may be, in grid rows — the grid's own resize limit. */
export const MAX_WIDGET_HEIGHT = 8;

/** The lowest row a widget may start on; bounds a layout an API caller sends. */
export const MAX_WIDGET_Y = 1000;

/** The size a chart's widget gets when nobody chose one. */
export const getDefaultWidgetLayout = (chartType: TChartType): TWidgetLayout => {
  if (chartType === "big_number") return { x: 0, y: 0, w: 3, h: 2 };
  // A grid of statements needs the width for its labels and the height for its rows.
  if (chartType === "matrix") return { x: 0, y: 0, w: 6, h: 5 };
  return { x: 0, y: 0, w: 4, h: 4 };
};

const overlaps = (a: TWidgetLayout, b: TWidgetLayout): boolean =>
  a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

/**
 * First position, scanning a row left to right before moving down, where a `w`x`h` widget fits
 * without overlapping an existing one. A duplicate therefore lands in the nearest gap instead of
 * on top of its original (the grid then shoves it to an arbitrary spot).
 */
export const findNextOpenSlot = (
  existing: TWidgetLayout[],
  { w, h }: Pick<TWidgetLayout, "w" | "h">,
  columns: number = GRID_COLUMNS
): Pick<TWidgetLayout, "x" | "y"> => {
  const width = Math.min(w, columns);
  const bottom = existing.reduce((max, layout) => Math.max(max, layout.y + layout.h), 0);

  for (let y = 0; y < bottom; y++) {
    for (let x = 0; x + width <= columns; x++) {
      if (!existing.some((layout) => overlaps({ x, y, w: width, h }, layout))) {
        return { x, y };
      }
    }
  }

  // Nothing fits in a gap, so start the row below every existing widget - always free.
  return { x: 0, y: bottom };
};

/**
 * Layouts are stored as JSON, so a row can hold anything. Malformed entries are dropped rather
 * than thrown on: they cannot be reasoned about for placement, and losing one only means the new
 * widget may overlap it.
 */
export const parseWidgetLayouts = (widgets: { layout: unknown }[]): TWidgetLayout[] =>
  widgets.reduce<TWidgetLayout[]>((layouts, widget) => {
    const parsed = ZWidgetLayout.safeParse(widget.layout);
    if (parsed.success) {
      layouts.push(parsed.data);
    }
    return layouts;
  }, []);

/**
 * The `x`/`y` a new widget takes on a dashboard that already holds `existingWidgets`: the first gap
 * it fits in, so a new or duplicated chart fills the space beside a narrower widget instead of
 * opening a new row below everything.
 *
 * A gap can only be trusted when every stored layout is readable: `layout` is a JSON column, and a
 * row that does not parse is a widget whose occupancy is unknown, so a "free" slot may be sitting
 * under it. Placement then falls back to keeping the requested `x` and starting the row below every
 * readable widget.
 */
export const resolveWidgetPosition = (
  existingWidgets: { layout: unknown }[],
  baseLayout: TWidgetLayout
): Pick<TWidgetLayout, "x" | "y"> => {
  const layouts = parseWidgetLayouts(existingWidgets);

  if (layouts.length === existingWidgets.length) {
    return findNextOpenSlot(layouts, baseLayout);
  }

  return {
    x: baseLayout.x,
    y: layouts.reduce((max, layout) => Math.max(max, layout.y + layout.h), 0),
  };
};

/**
 * The first of `others` that `layout` would cover, or `null`. Widgets may leave gaps but never
 * overlap: an overlap is drawn by the grid shoving one of them somewhere the caller did not choose.
 * A stored layout that does not parse is skipped — its occupancy is unknown, and refusing every
 * placement on that dashboard for it would be worse than the overlap it might hide.
 */
export const findOverlappingWidget = <T extends { id: string; layout: unknown }>(
  layout: TWidgetLayout,
  others: T[]
): T | null =>
  others.find((other) => {
    const parsed = ZWidgetLayout.safeParse(other.layout);
    return parsed.success && overlaps(layout, parsed.data);
  }) ?? null;
