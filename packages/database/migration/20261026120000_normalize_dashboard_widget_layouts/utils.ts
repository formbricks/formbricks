/**
 * The grid rules the dashboard API holds every widget layout to. Frozen here as of this migration:
 * `packages/database` cannot import the web app, and a later change to the app's rules must not change
 * what this migration did.
 */
export const GRID_COLUMNS = 12;
export const MAX_WIDGET_HEIGHT = 8;
export const MAX_WIDGET_Y = 1000;
const DEFAULT_LAYOUT = { x: 0, y: 0, w: 4, h: 3 } as const;

export type TWidgetLayout = { x: number; y: number; w: number; h: number };

export type TStoredWidget = { id: string; layout: unknown; order: number };

const clamp = (value: number, min: number, max: number): number => Math.min(Math.max(value, min), max);

/** A whole number from a stored value, or `fallback` when it is not a finite number. */
const wholeOr = (value: unknown, fallback: number): number =>
  typeof value === "number" && Number.isFinite(value) ? Math.round(value) : fallback;

/** One stored layout within the grid's bounds, on its own; overlaps are resolved by `repairLayouts`. */
export const boundLayout = (stored: unknown): TWidgetLayout => {
  const raw = typeof stored === "object" && stored !== null ? (stored as Record<string, unknown>) : {};
  const w = clamp(wholeOr(raw.w, DEFAULT_LAYOUT.w), 1, GRID_COLUMNS);
  const x = clamp(wholeOr(raw.x, DEFAULT_LAYOUT.x), 0, GRID_COLUMNS - w);
  const h = clamp(wholeOr(raw.h, DEFAULT_LAYOUT.h), 1, MAX_WIDGET_HEIGHT);
  const y = clamp(wholeOr(raw.y, DEFAULT_LAYOUT.y), 0, MAX_WIDGET_Y);
  return { x, y, w, h };
};

const sameLayout = (stored: unknown, layout: TWidgetLayout): boolean => {
  if (typeof stored !== "object" || stored === null) return false;
  const raw = stored as Record<string, unknown>;
  return (
    Object.keys(raw).length === 4 &&
    raw.x === layout.x &&
    raw.y === layout.y &&
    raw.w === layout.w &&
    raw.h === layout.h
  );
};

/**
 * The layouts one dashboard's widgets need so the API accepts them back: each within the grid's
 * bounds, and none overlapping. Widgets are taken top to bottom, then left to right, then in their
 * saved order, and each lands no higher than it was and below everything already placed in its columns
 * (a per-column skyline), so its column and size are kept and the dashboard reads the same. A layout
 * the API already accepts comes back unchanged: in it, nothing placed earlier reaches below a later
 * widget's top in the columns they share.
 *
 * Linear in the number of widgets, so a dashboard planted with thousands of identical layouts cannot
 * stall the migration.
 *
 * Returns only the widgets whose stored layout changes.
 */
export const repairLayouts = (widgets: TStoredWidget[]): { id: string; layout: TWidgetLayout }[] => {
  const bounded = widgets
    .map((widget) => ({ ...widget, bounded: boundLayout(widget.layout) }))
    .sort(
      (a, b) =>
        a.bounded.y - b.bounded.y ||
        a.bounded.x - b.bounded.x ||
        a.order - b.order ||
        a.id.localeCompare(b.id)
    );

  // The first free row in each column, below every widget placed so far.
  const skyline = new Array<number>(GRID_COLUMNS).fill(0);
  const changed: { id: string; layout: TWidgetLayout }[] = [];
  for (const widget of bounded) {
    const { x, w, h } = widget.bounded;
    const columns = skyline.slice(x, x + w);
    const layout = { ...widget.bounded, y: Math.max(widget.bounded.y, ...columns) };
    skyline.fill(layout.y + h, x, x + w);
    if (!sameLayout(widget.layout, layout)) changed.push({ id: widget.id, layout });
  }
  return changed;
};
