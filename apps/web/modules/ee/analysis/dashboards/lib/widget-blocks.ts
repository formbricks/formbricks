import {
  type TDashboardImageContent,
  type TDashboardTextContent,
  type TDashboardWidgetKind,
  type TWidgetLayout,
  ZDashboardImageContent,
  ZDashboardTextContent,
} from "@formbricks/types/analysis";
import { GRID_COLUMNS, MAX_WIDGET_HEIGHT, findNextOpenSlot } from "./widget-placement";

/**
 * Layout blocks (ENG-7249–7251): the image, text and separator widgets a dashboard page holds beside its
 * charts. Pure rules shared by the page, the v3 operations and their tests.
 */

export type TLayoutBlockKind = Exclude<TDashboardWidgetKind, "chart">;

export const LAYOUT_BLOCK_KINDS = [
  "image",
  "text",
  "separator",
] as const satisfies readonly TLayoutBlockKind[];

/** The size a new block gets: an image a quarter row, a text block three quarters, a separator the full row. */
export const getDefaultBlockLayout = (kind: TLayoutBlockKind): TWidgetLayout => {
  if (kind === "image") return { x: 0, y: 0, w: 3, h: 3 };
  if (kind === "text") return { x: 0, y: 0, w: 9, h: 2 };
  return { x: 0, y: 0, w: GRID_COLUMNS, h: 1 };
};

/** The smallest a block may be resized to. A separator stays one row high; height of the others follows content. */
export const getBlockMinSize = (kind: TLayoutBlockKind): { minW: number; minH: number } => ({
  minW: kind === "separator" ? 1 : 2,
  minH: 1,
});

/** Whether a block's height is set by its content rather than by the person editing. */
export const isAutoHeightBlock = (kind: TDashboardWidgetKind): kind is "image" | "text" =>
  kind === "image" || kind === "text";

/** A new image block: empty, fitted and centred. */
export const DEFAULT_IMAGE_CONTENT: TDashboardImageContent = {
  fileUrl: null,
  fit: "fit",
  position: "center",
  alt: "",
};

/** A new text block: empty until someone types; it cannot be saved like that (`isTextBlockEmpty`). */
export const EMPTY_TEXT_CONTENT: TDashboardTextContent = { headline: "", description: "" };

/** A text block with neither a headline nor a description: refused on save. */
export const isTextBlockEmpty = (content: { headline: string; description: string }): boolean =>
  content.headline.trim().length === 0 && content.description.trim().length === 0;

/** The content a new block of `kind` starts with. */
export const getDefaultBlockContent = (
  kind: TLayoutBlockKind
): TDashboardImageContent | TDashboardTextContent | null => {
  if (kind === "image") return { ...DEFAULT_IMAGE_CONTENT };
  if (kind === "text") return { ...EMPTY_TEXT_CONTENT };
  return null;
};

/**
 * Where a new block of `kind` lands on a page whose widgets take `existing`: the first open slot at its
 * default size, scanning rows left to right.
 */
export const placeNewBlock = (kind: TLayoutBlockKind, existing: TWidgetLayout[]): TWidgetLayout => {
  const size = getDefaultBlockLayout(kind);
  return { ...size, ...findNextOpenSlot(existing, size) };
};

/**
 * The private storage URL an image block may point at: a dashboard upload of this workspace
 * (`/storage/<workspaceId>/private/dashboards/<dashboardId>/<file>`). Anything else, an outside URL or a
 * file of another workspace, is refused, so a block can never show another tenant's file.
 */
export const isDashboardImageUrl = (fileUrl: string, workspaceId: string): boolean => {
  const prefix = `/storage/${workspaceId}/private/dashboards/`;
  if (!fileUrl.startsWith(prefix)) return false;
  const rest = fileUrl.slice(prefix.length).split("/");
  return (
    rest.length === 2 &&
    /^[a-z0-9]{1,64}$/.test(rest[0]) &&
    rest[1].length > 0 &&
    !rest[1].includes("..") &&
    !rest[1].includes("\\")
  );
};

export type TWidgetContentIssue = { reason: string };

/**
 * THE content rule for every widget write (v3 add, update and save, MCP): a chart and a separator carry
 * none; an image carries `ZDashboardImageContent` with an upload of this workspace or no file; a text
 * block `ZDashboardTextContent`, which refuses both parts empty. Returns the content to store, or why not.
 */
export const parseWidgetContent = (
  kind: TDashboardWidgetKind,
  content: unknown,
  workspaceId: string
):
  | { ok: true; content: TDashboardImageContent | TDashboardTextContent | null }
  | ({ ok: false } & TWidgetContentIssue) => {
  if (kind === "chart" || kind === "separator") {
    return content === undefined || content === null
      ? { ok: true, content: null }
      : { ok: false, reason: `A ${kind} widget has no content.` };
  }
  if (kind === "image") {
    const parsed = ZDashboardImageContent.safeParse(content ?? DEFAULT_IMAGE_CONTENT);
    if (!parsed.success)
      return { ok: false, reason: parsed.error.issues[0]?.message ?? "Invalid image content." };
    if (parsed.data.fileUrl !== null && !isDashboardImageUrl(parsed.data.fileUrl, workspaceId)) {
      return { ok: false, reason: "fileUrl must be a dashboard image uploaded to this workspace." };
    }
    return { ok: true, content: parsed.data };
  }
  const parsed = ZDashboardTextContent.safeParse(content);
  if (!parsed.success)
    return { ok: false, reason: parsed.error.issues[0]?.message ?? "Invalid text content." };
  return { ok: true, content: parsed.data };
};

/**
 * How many grid rows a block needs to show `contentPx` of content without clipping, on a grid whose rows
 * are `rowHeight` tall with `margin` between them: `h` rows span `h * rowHeight + (h - 1) * margin`.
 * At least one row, at most the grid's resize limit.
 */
export const pixelsToGridRows = (
  contentPx: number,
  rowHeight: number,
  margin: number,
  maxRows: number = MAX_WIDGET_HEIGHT
): number => {
  if (!Number.isFinite(contentPx) || contentPx <= 0) return 1;
  const rows = Math.ceil((contentPx + margin) / (rowHeight + margin));
  return Math.min(Math.max(rows, 1), maxRows);
};

/**
 * Auto-height for image and text blocks: each takes the rows its measured content needs, and blocks that
 * start on the same grid row take the tallest of them, so a row of blocks lines up. Widgets without a
 * measurement (charts, separators, blocks not yet measured) keep their height. Returns the same array
 * when nothing changes, so a caller can skip a re-render.
 */
export const fitBlockHeights = <
  T extends { id: string; kind: TDashboardWidgetKind; layout: TWidgetLayout; pageId?: string },
>(
  widgets: T[],
  neededRows: ReadonlyMap<string, number>
): T[] => {
  // Rows are a page's own: blocks on different pages never line up with each other.
  const rowKey = (widget: T) => `${widget.pageId ?? ""}:${widget.layout.y}`;
  const tallestByRow = new Map<string, number>();
  for (const widget of widgets) {
    const rows = isAutoHeightBlock(widget.kind) ? neededRows.get(widget.id) : undefined;
    if (rows === undefined) continue;
    tallestByRow.set(rowKey(widget), Math.max(tallestByRow.get(rowKey(widget)) ?? 0, rows));
  }
  let changed = false;
  const fitted = widgets.map((widget) => {
    if (!isAutoHeightBlock(widget.kind) || !neededRows.has(widget.id)) return widget;
    const h = tallestByRow.get(rowKey(widget)) ?? widget.layout.h;
    if (h === widget.layout.h) return widget;
    changed = true;
    return { ...widget, layout: { ...widget.layout, h } };
  });
  return changed ? fitted : widgets;
};
