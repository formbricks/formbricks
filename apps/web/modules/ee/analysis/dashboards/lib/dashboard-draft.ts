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
  return {
    pages: renumber([...pages, { id: pageId, name, order: pages.length, limited: false, teamIds: [] }]),
    pageId,
  };
};

export const renameDraftPage = (pages: TDashboardPage[], pageId: string, name: string): TDashboardPage[] =>
  pages.map((page) => (page.id === pageId ? { ...page, name } : page));

/**
 * Sets a page's team limit: `null` for "All teams", or the teams it is limited to. An empty list is kept
 * as a limit to no team, never read as "All teams".
 */
export const setDraftPageTeams = (
  pages: TDashboardPage[],
  pageId: string,
  teamIds: string[] | null
): TDashboardPage[] =>
  pages.map((page) =>
    page.id === pageId ? { ...page, limited: teamIds !== null, teamIds: teamIds ?? [] } : page
  );

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

/**
 * An image block's uploaded file put into the draft as it is now: only `fileUrl` changes, so alt text,
 * fit and position set while the upload ran are kept. A block removed meanwhile stays removed.
 */
export const setDraftImageFile = (
  widgets: TDashboardWidget[],
  widgetId: string,
  fileUrl: string
): TDashboardWidget[] =>
  widgets.map((widget) =>
    widget.id === widgetId && widget.kind === "image"
      ? { ...widget, content: { ...widget.content, fileUrl } }
      : widget
  );

/** One image upload: the block it is for, and the edit session it started in. */
export interface TImageUploadTicket {
  readonly id: number;
  readonly widgetId: string;
  readonly editSession: number;
}

/**
 * The dashboard's image uploads, kept by the dashboard rather than the block: switching pages remounts a
 * block, so a block cannot tell its own earlier upload is still running. `end` says whether an ended
 * upload's file goes into the draft: only the block's latest upload, and only while the edit session it
 * started in is still open, so an older upload finishing late, or one outliving a Cancel, changes nothing.
 */
export const createImageUploadTracker = () => {
  let lastId = 0;
  const latestByWidget = new Map<string, number>();
  return {
    start(widgetId: string, editSession: number): TImageUploadTicket {
      lastId += 1;
      latestByWidget.set(widgetId, lastId);
      return { id: lastId, widgetId, editSession };
    },
    end(ticket: TImageUploadTicket, activeEditSession: number | null): boolean {
      const isLatest = latestByWidget.get(ticket.widgetId) === ticket.id;
      if (isLatest) latestByWidget.delete(ticket.widgetId);
      return isLatest && activeEditSession === ticket.editSession;
    },
  };
};

/** Text blocks the save would refuse: neither a headline nor a description. */
export const findEmptyTextBlocks = (widgets: TDashboardWidget[]): TDashboardWidget[] =>
  widgets.filter((widget) => widget.kind === "text" && isTextBlockEmpty(widget.content));

export const sameTeams = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && a.every((teamId) => b.includes(teamId));

/** Whether two pages have the same team limit: both "All teams", or both limited to the same teams. */
export const samePageLimit = (
  a: Pick<TDashboardPage, "limited" | "teamIds">,
  b: Pick<TDashboardPage, "limited" | "teamIds">
): boolean => a.limited === b.limited && (!a.limited || sameTeams(a.teamIds, b.teamIds));

/** Whether the draft pages differ from the saved ones: added, removed, renamed, reordered or re-limited. */
export const pagesChanged = (draft: TDashboardPage[], saved: TDashboardPage[]): boolean =>
  draft.length !== saved.length ||
  draft.some((page, index) => {
    const other = saved[index];
    return (
      page.id !== other.id ||
      page.name !== other.name ||
      page.order !== other.order ||
      !samePageLimit(page, other)
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
 * permission only when a limit really changes. "All teams" is sent as `null`; a limit to no team as `[]`.
 */
export const toSavedPages = (pages: TDashboardPage[], saved: TDashboardPage[]): TSavedPage[] =>
  pages.map((page, order) => {
    const before = saved.find((other) => other.id === page.id);
    const limitChanged = before ? !samePageLimit(before, page) : page.limited;
    return {
      ...(isDraftId(page.id) ? { key: page.id } : { pageId: page.id }),
      name: page.name.trim(),
      order,
      ...(limitChanged ? { teamIds: page.limited ? page.teamIds : null } : {}),
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
