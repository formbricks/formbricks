import type { TDashboardPage, TDashboardWidget } from "@/modules/ee/analysis/types/analysis";
import { isDraftId } from "./dashboard-draft";

export { toSavedWidgets } from "./dashboard-draft";

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
 * The editor's pages, as a save over the latest version can send them: a page someone else deleted
 * meanwhile is no longer there to keep, so it is dropped; pages the editor added stay.
 */
export const draftPagesOverLatest = (latest: TDashboardPage[], draft: TDashboardPage[]): TDashboardPage[] => {
  const present = new Set(latest.map((page) => page.id));
  const kept = draft.filter((page) => isDraftId(page.id) || present.has(page.id));
  return kept.length > 0 ? kept : latest;
};

/**
 * The editor's widgets, as a save over the latest version can send them: a widget someone else removed
 * meanwhile is no longer there to place, and one on a page that is gone has nowhere to go, so both are
 * dropped rather than failing the whole save. Widgets the editor added stay.
 */
export const draftOverLatest = (
  latest: TDashboardWidget[],
  draft: TDashboardWidget[],
  pages?: TDashboardPage[]
): TDashboardWidget[] => {
  const present = new Set(latest.map((widget) => widget.id));
  const pageIds = pages ? new Set(pages.map((page) => page.id)) : null;
  return draft.filter(
    (widget) => (isDraftId(widget.id) || present.has(widget.id)) && (!pageIds || pageIds.has(widget.pageId))
  );
};
