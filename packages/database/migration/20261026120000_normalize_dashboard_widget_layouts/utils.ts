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

const overlaps = (a: TWidgetLayout, b: TWidgetLayout): boolean =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

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
 * saved order; one that overlaps a widget already placed moves straight down until it is clear, the
 * way the editor's grid pushes widgets. Its column and size are kept, so the dashboard reads the same.
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

  const placed: TWidgetLayout[] = [];
  const changed: { id: string; layout: TWidgetLayout }[] = [];
  for (const widget of bounded) {
    const layout = { ...widget.bounded };
    for (let clash = placed.find((other) => overlaps(layout, other)); clash; ) {
      layout.y = clash.y + clash.h;
      clash = placed.find((other) => overlaps(layout, other));
    }
    placed.push(layout);
    if (!sameLayout(widget.layout, layout)) changed.push({ id: widget.id, layout });
  }
  return changed;
};
