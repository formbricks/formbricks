/**
 * Per-viewer choice between a widget's chart and its underlying data table.
 *
 * The preference is deliberately not stored on the chart: two people looking at the same
 * dashboard want different things from the same widget, and one of them switching to the table
 * should not rewrite the dashboard for everyone. localStorage keeps it per browser, and keying by
 * widget id (not chart id) means the same chart added to two dashboards is remembered separately.
 */

export const WIDGET_VIEWS = ["chart", "data"] as const;
export type TWidgetView = (typeof WIDGET_VIEWS)[number];

export const DEFAULT_WIDGET_VIEW: TWidgetView = "chart";

const STORAGE_KEY_PREFIX = "formbricks-widget-view";

export const getWidgetViewStorageKey = (widgetId: string): string => `${STORAGE_KEY_PREFIX}-${widgetId}`;

const isWidgetView = (value: string | null): value is TWidgetView =>
  value !== null && (WIDGET_VIEWS as readonly string[]).includes(value);

/**
 * Read a widget's stored view. Falls back to the chart for anything unexpected — a missing entry,
 * a value written by an older or newer build, or a browser that denies storage access (Safari in
 * private mode throws on `localStorage` rather than returning null).
 */
export const readStoredWidgetView = (widgetId: string): TWidgetView => {
  if (typeof window === "undefined") return DEFAULT_WIDGET_VIEW;

  try {
    const stored = window.localStorage.getItem(getWidgetViewStorageKey(widgetId));
    return isWidgetView(stored) ? stored : DEFAULT_WIDGET_VIEW;
  } catch {
    return DEFAULT_WIDGET_VIEW;
  }
};

/**
 * Persist a widget's view. Writing the default removes the entry instead of storing it, so a
 * dashboard that is never toggled leaves nothing behind.
 */
export const writeStoredWidgetView = (widgetId: string, view: TWidgetView): void => {
  if (typeof window === "undefined") return;

  try {
    const key = getWidgetViewStorageKey(widgetId);
    if (view === DEFAULT_WIDGET_VIEW) {
      window.localStorage.removeItem(key);
    } else {
      window.localStorage.setItem(key, view);
    }
  } catch {
    // Storage unavailable (private mode, quota, blocked cookies): the toggle still works for this
    // page view, it just will not survive a reload. Losing a view preference is not worth an error.
  }
};
