import "server-only";
import { ZWidgetLayout } from "@formbricks/types/analysis";
import { serializeV3Chart } from "@/app/api/v3/charts/lib/serializers";
import type {
  TV3DashboardListItem,
  TV3DashboardResource,
  TV3DashboardWidget,
  TV3WidgetLayout,
} from "./resources";
import type { TDashboardListRow, TDashboardResourceRow } from "./service";

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

export const serializeV3DashboardWidget = (
  widget: TDashboardResourceRow["widgets"][number]
): TV3DashboardWidget => ({
  id: widget.id,
  chartId: widget.chartId,
  layout: parseStoredLayout(widget.layout),
  order: widget.order,
  chart: serializeV3Chart(widget.chart),
});

export const serializeV3Dashboard = (row: TDashboardResourceRow): TV3DashboardResource => ({
  id: row.id,
  workspaceId: row.workspaceId,
  name: row.name,
  creator: row.creator ? { name: row.creator.name } : null,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
  widgets: row.widgets.map(serializeV3DashboardWidget),
});
