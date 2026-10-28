import type { TDashboardWidget } from "@/modules/ee/analysis/types/analysis";

/**
 * What saving an edit over a dashboard that changed meanwhile would remove without the editor asking:
 * a widget that appeared after the edit began and is not in the draft. A widget the editor removed in the
 * draft is absent from `base` too, so it is their own change, not a warning.
 */
export const widgetsRemovedByOverwrite = (
  latest: TDashboardWidget[],
  draft: TDashboardWidget[],
  base: ReadonlySet<string>
): TDashboardWidget[] => {
  const kept = new Set(draft.map((widget) => widget.id));
  return latest.filter((widget) => !kept.has(widget.id) && !base.has(widget.id));
};

/**
 * The editor's widgets, as a save over the latest version can send them: a widget someone else removed
 * meanwhile is no longer there to place, so it is dropped rather than failing the whole save.
 */
export const draftOverLatest = (
  latest: TDashboardWidget[],
  draft: TDashboardWidget[]
): TDashboardWidget[] => {
  const present = new Set(latest.map((widget) => widget.id));
  return draft.filter((widget) => present.has(widget.id));
};

/** The widgets as the whole-dashboard save sends them, ordered as they are listed. */
export const toSavedWidgets = (widgets: TDashboardWidget[]) =>
  widgets.map((widget, order) => ({ widgetId: widget.id, layout: widget.layout, order }));
