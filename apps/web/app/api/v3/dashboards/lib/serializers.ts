import "server-only";
import {
  MAX_TEXT_BLOCK_DESCRIPTION_LENGTH,
  MAX_TEXT_BLOCK_HEADLINE_LENGTH,
  type TDashboardWidgetKind,
  ZDashboardImageContent,
  ZWidgetLayout,
} from "@formbricks/types/analysis";
import { serializeV3Chart } from "@/app/api/v3/charts/lib/serializers";
import { parseStoredDashboardFilters } from "@/modules/ee/analysis/dashboards/lib/dashboard-filters";
import { DEFAULT_IMAGE_CONTENT } from "@/modules/ee/analysis/dashboards/lib/widget-blocks";
import type {
  TV3DashboardListItem,
  TV3DashboardPage,
  TV3DashboardResource,
  TV3DashboardWidget,
  TV3WidgetLayout,
} from "./resources";
import type {
  TDashboardListRow,
  TDashboardResourceRow,
  TPageResourceRow,
  TWidgetResourceRow,
} from "./service";

/**
 * The size a widget is drawn at when its stored layout cannot be read. `layout` is a JSON column, so a
 * row written outside the API could hold anything; serving a readable default keeps the dashboard
 * drawable rather than failing the whole read for one widget.
 */
const FALLBACK_LAYOUT: TV3WidgetLayout = { x: 0, y: 0, w: 4, h: 4 };

export const parseStoredLayout = (layout: unknown): TV3WidgetLayout => {
  const parsed = ZWidgetLayout.safeParse(layout);
  return parsed.success
    ? { x: parsed.data.x, y: parsed.data.y, w: parsed.data.w, h: parsed.data.h }
    : FALLBACK_LAYOUT;
};

export const serializeV3DashboardListItem = (row: TDashboardListRow): TV3DashboardListItem => ({
  id: row.id,
  workspaceId: row.workspaceId,
  name: row.name,
  creator: row.creator ? { name: row.creator.name } : null,
  widgetCount: row._count.widgets,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
});

/**
 * A block's stored content as read. `content` is a JSON column, so a row written outside the API could hold
 * anything: an unreadable image reads as an empty one, an unreadable text block as empty text, rather than
 * failing the whole dashboard for one block.
 */
export const parseStoredWidgetContent = (
  kind: TDashboardWidgetKind,
  content: unknown
): TV3DashboardWidget["content"] => {
  if (kind === "image") {
    const parsed = ZDashboardImageContent.safeParse(content);
    return parsed.success ? parsed.data : { ...DEFAULT_IMAGE_CONTENT };
  }
  if (kind === "text") {
    const value = (content ?? {}) as { headline?: unknown; description?: unknown };
    return {
      headline:
        typeof value.headline === "string" ? value.headline.slice(0, MAX_TEXT_BLOCK_HEADLINE_LENGTH) : "",
      description:
        typeof value.description === "string"
          ? value.description.slice(0, MAX_TEXT_BLOCK_DESCRIPTION_LENGTH)
          : "",
    };
  }
  return null;
};

export const serializeV3DashboardWidget = (widget: TWidgetResourceRow): TV3DashboardWidget => {
  // A chart widget always has its chart (the foreign key cascades); a row that lost it reads as what it
  // still is, a placement without a chart, rather than failing the read.
  const kind = widget.kind;
  return {
    id: widget.id,
    pageId: widget.pageId,
    kind,
    chartId: kind === "chart" ? widget.chartId : null,
    layout: parseStoredLayout(widget.layout),
    order: widget.order,
    chart: kind === "chart" && widget.chart ? serializeV3Chart(widget.chart) : null,
    content: parseStoredWidgetContent(kind, widget.content),
  };
};

export const serializeV3DashboardPage = (page: TPageResourceRow): TV3DashboardPage => ({
  id: page.id,
  name: page.name,
  order: page.order,
  teamIds: page.teamLimits.map(({ teamId }) => teamId),
});

export const serializeV3Dashboard = (row: TDashboardResourceRow): TV3DashboardResource => ({
  id: row.id,
  workspaceId: row.workspaceId,
  name: row.name,
  creator: row.creator ? { name: row.creator.name } : null,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
  filters: parseStoredDashboardFilters(row.filters),
  pages: row.pages.map(serializeV3DashboardPage),
  widgets: row.widgets.map(serializeV3DashboardWidget),
});
