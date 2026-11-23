import type { TWidgetLayout } from "@formbricks/types/analysis";
import type { TSavedPage, TSavedWidget } from "@/modules/ee/analysis/lib/api-client";
import type {
  TChart,
  TDashboardChartWidget,
  TDashboardPage,
  TDashboardWidget,
} from "@/modules/ee/analysis/types/analysis";
import {
  type TLayoutBlockKind,
  getDefaultBlockContent,
  isTextBlockEmpty,
  placeNewBlock,
} from "./widget-blocks";
import { findNextOpenSlot, getDefaultWidgetLayout } from "./widget-placement";

/**
 * The edit-mode draft of a dashboard's pages and widgets (ENG-7480): what the editor changes before the one
 * whole-dashboard save. Pages and blocks added in the draft carry a draft id until the save creates them;
 * the save names a new page by that id as its `key`.
 */

const DRAFT_PREFIX = "draft-";

/** Whether an id names a page or widget that exists only in the draft. */
export const isDraftId = (id: string): boolean => id.startsWith(DRAFT_PREFIX);

let draftCounter = 0;
/** A fresh draft id; unique within the page's lifetime, and a valid page key for the save. */
export const newDraftId = (): string => {
  draftCounter += 1;
  return `${DRAFT_PREFIX}${Date.now().toString(36)}-${draftCounter}`;
};

/** Pages in tab order, numbered from 0, so the order the editor sees is the order saved. */
const renumber = (pages: TDashboardPage[]): TDashboardPage[] =>
  pages.map((page, order) => (page.order === order ? page : { ...page, order }));

/** The page to show: the one asked for when it exists, otherwise the first. */
export const resolveSelectedPageId = (pages: TDashboardPage[], requested: string | null): string | null =>
  pages.find((page) => page.id === requested)?.id ?? pages[0]?.id ?? null;

/** Adds a page last, open to all teams. Returns the pages and the new page's id. */
export const addDraftPage = (
  pages: TDashboardPage[],
  name: string
): { pages: TDashboardPage[]; pageId: string } => {
  const pageId = newDraftId();
  return { pages: renumber([...pages, { id: pageId, name, order: pages.length, teamIds: [] }]), pageId };
};

export const renameDraftPage = (pages: TDashboardPage[], pageId: string, name: string): TDashboardPage[] =>
  pages.map((page) => (page.id === pageId ? { ...page, name } : page));

export const setDraftPageTeams = (
  pages: TDashboardPage[],
  pageId: string,
  teamIds: string[]
): TDashboardPage[] => pages.map((page) => (page.id === pageId ? { ...page, teamIds } : page));

/** Deletes a page and its widgets; the last page is kept, as a dashboard always has one. */
export const deleteDraftPage = (
  pages: TDashboardPage[],
  widgets: TDashboardWidget[],
  pageId: string
): { pages: TDashboardPage[]; widgets: TDashboardWidget[] } => {
  if (pages.length <= 1) return { pages, widgets };
  return {
    pages: renumber(pages.filter((page) => page.id !== pageId)),
    widgets: widgets.filter((widget) => widget.pageId !== pageId),
  };
};

/** Moves page `activeId` to where page `overId` is, as a drag drops it. */
export const moveDraftPage = (
  pages: TDashboardPage[],
  activeId: string,
  overId: string
): TDashboardPage[] => {
  const from = pages.findIndex((page) => page.id === activeId);
  const to = pages.findIndex((page) => page.id === overId);
  if (from < 0 || to < 0 || from === to) return pages;
  const next = [...pages];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return renumber(next);
};

const layoutsOn = (widgets: TDashboardWidget[], pageId: string): TWidgetLayout[] =>
  widgets.filter((widget) => widget.pageId === pageId).map((widget) => widget.layout);

/** A new layout block on `pageId`, in the next free slot at its kind's default size. */
export const addDraftBlock = (
  widgets: TDashboardWidget[],
  { kind, pageId, dashboardId }: { kind: TLayoutBlockKind; pageId: string; dashboardId: string }
): { widgets: TDashboardWidget[]; widgetId: string } => {
  const id = newDraftId();
  const base = {
    id,
    dashboardId,
    pageId,
    layout: placeNewBlock(kind, layoutsOn(widgets, pageId)),
    order: widgets.length,
    chartId: null,
    chart: null,
  };
  const content = getDefaultBlockContent(kind);
  let widget: TDashboardWidget;
  if (kind === "image")
    widget = { ...base, kind, content: content as TDashboardWidget["content"] & object } as TDashboardWidget;
  else if (kind === "text")
    widget = { ...base, kind, content: content as TDashboardWidget["content"] & object } as TDashboardWidget;
  else widget = { ...base, kind, content: null };
  return { widgets: [...widgets, widget], widgetId: id };
};

/**
 * Charts put on `pageId`, each in the next free slot at its type's default size. A chart already on that
 * page is skipped: a chart sits on a page at most once.
 */
export const addDraftCharts = (
  widgets: TDashboardWidget[],
  { charts, pageId, dashboardId }: { charts: TChart[]; pageId: string; dashboardId: string }
): TDashboardWidget[] => {
  const next = [...widgets];
  for (const chart of charts) {
    if (next.some((widget) => widget.pageId === pageId && widget.chartId === chart.id)) continue;
    const size = getDefaultWidgetLayout(chart.type);
    const widget: TDashboardChartWidget = {
      id: newDraftId(),
      dashboardId,
      pageId,
      kind: "chart",
      chartId: chart.id,
      chart,
      content: null,
      layout: { ...size, ...findNextOpenSlot(layoutsOn(next, pageId), size) },
      order: next.length,
    };
    next.push(widget);
  }
  return next;
};

/** Text blocks the save would refuse: neither a headline nor a description. */
export const findEmptyTextBlocks = (widgets: TDashboardWidget[]): TDashboardWidget[] =>
  widgets.filter((widget) => widget.kind === "text" && isTextBlockEmpty(widget.content));

const sameTeams = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && a.every((teamId) => b.includes(teamId));

/** Whether the draft pages differ from the saved ones: added, removed, renamed, reordered or re-limited. */
export const pagesChanged = (draft: TDashboardPage[], saved: TDashboardPage[]): boolean =>
  draft.length !== saved.length ||
  draft.some((page, index) => {
    const other = saved[index];
    return (
      page.id !== other.id ||
      page.name !== other.name ||
      page.order !== other.order ||
      !sameTeams(page.teamIds, other.teamIds)
    );
  });

/** Whether the draft widgets differ from the saved ones: placement, page, order or content. */
export const widgetsChanged = (draft: TDashboardWidget[], saved: TDashboardWidget[]): boolean =>
  draft.length !== saved.length ||
  draft.some((widget, index) => {
    const other = saved[index];
    return (
      widget.id !== other.id ||
      widget.pageId !== other.pageId ||
      widget.order !== other.order ||
      widget.layout.x !== other.layout.x ||
      widget.layout.y !== other.layout.y ||
      widget.layout.w !== other.layout.w ||
      widget.layout.h !== other.layout.h ||
      JSON.stringify(widget.content) !== JSON.stringify(other.content)
    );
  });

/**
 * The pages as the save sends them, in tab order. A team limit is sent only where it differs from
 * `saved`, so an editor who cannot change limits never sends one, and the server is asked for the
 * permission only when a limit really changes.
 */
export const toSavedPages = (pages: TDashboardPage[], saved: TDashboardPage[]): TSavedPage[] =>
  pages.map((page, order) => {
    const before = saved.find((other) => other.id === page.id);
    const limitChanged = before ? !sameTeams(before.teamIds, page.teamIds) : page.teamIds.length > 0;
    return {
      ...(isDraftId(page.id) ? { key: page.id } : { pageId: page.id }),
      name: page.name.trim(),
      order,
      ...(limitChanged ? { teamIds: page.teamIds } : {}),
    };
  });

/** The widgets as the save sends them, ordered as they are listed: new ones by kind, all with their page. */
export const toSavedWidgets = (widgets: TDashboardWidget[]): TSavedWidget[] =>
  widgets.map((widget, order) => {
    const page = isDraftId(widget.pageId) ? { pageKey: widget.pageId } : { pageId: widget.pageId };
    const content = widget.kind === "image" || widget.kind === "text" ? { content: widget.content } : {};
    if (isDraftId(widget.id)) {
      return {
        kind: widget.kind,
        ...(widget.kind === "chart" ? { chartId: widget.chartId } : {}),
        ...page,
        ...content,
        layout: widget.layout,
        order,
      };
    }
    return { widgetId: widget.id, ...page, ...content, layout: widget.layout, order };
  });
