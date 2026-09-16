import { TWidgetLayout, ZWidgetLayout } from "@formbricks/types/analysis";

/** Columns of the `lg` breakpoint, the one the stored layouts are expressed in. */
export const GRID_COLUMNS = 12;

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
      const overlaps = existing.some(
        (layout) =>
          x < layout.x + layout.w && x + width > layout.x && y < layout.y + layout.h && y + h > layout.y
      );
      if (!overlaps) {
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
