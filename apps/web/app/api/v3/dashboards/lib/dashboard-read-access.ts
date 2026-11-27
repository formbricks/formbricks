import "server-only";
import type { TV3ChartOperationContext } from "@/app/api/v3/charts/lib/access";
import { type TDashboardsAccessContext, getDashboardReadSubject } from "@/app/api/v3/lib/dashboards-access";
import { problemForbidden } from "@/app/api/v3/lib/response";
import {
  type TDashboardAccessSubject,
  canReadDashboard,
  filterReadableDashboardIdsInWorkspace,
  filterReadablePageIds,
} from "@/modules/ee/dashboard-access/lib/spicedb-access";
import { getDashboardReadPrincipal, withCachedDashboardDecision } from "./read-decision-cache";
import { listDashboardPageScopeRows } from "./service";

/**
 * Which dashboards and pages a dashboard-bound read reaches (ENG-7472, ADR-0060). Owners, Managers,
 * Members and API keys reach every dashboard and page of a workspace they read, so nothing here asks
 * anything of them. A Dashboard Viewer — or an Owner or Manager viewing as one — is decided in SpiceDB on
 * the projected `dashboard` and `dashboard_page` nodes, where team dashboard limits and page team limits
 * live.
 */

type TReadDashboard = { id: string; updatedAt: Date };

/** A Dashboard Viewer read of a dashboard they cannot open: the same 403 as a dashboard they never could. */
export const refuseUnlessDashboardOpenable = async (
  access: TDashboardsAccessContext,
  dashboardId: string,
  {
    authentication,
    requestId,
    instance,
  }: Pick<TV3ChartOperationContext, "authentication" | "requestId" | "instance">
): Promise<Response | null> => {
  if (!access.asDashboardViewer) return null;
  const subject = getDashboardReadSubject(authentication, access);
  if (subject && (await canReadDashboard(subject, dashboardId))) return null;
  return problemForbidden(requestId, "You are not authorized to access this resource", instance);
};

/** Of `pageIds`, those the read reaches: all of them, or for a Dashboard Viewer those SpiceDB allows. */
export const getReadablePageIds = async (
  access: TDashboardsAccessContext,
  pageIds: readonly string[],
  authentication: TV3ChartOperationContext["authentication"]
): Promise<Set<string>> => {
  if (!access.asDashboardViewer) return new Set(pageIds);
  const subject = getDashboardReadSubject(authentication, access);
  if (!subject) return new Set();
  return filterReadablePageIds(subject, pageIds);
};

/**
 * `getReadablePageIds` for the per-widget reads (a chart's data, a value list), each page's allow kept for
 * the read-decision TTL under `page:<pageId>`, so a page limit change is decided page by page.
 */
export const getReadablePageIdsCached = async (
  access: TDashboardsAccessContext,
  dashboard: TReadDashboard,
  pageIds: readonly string[],
  context: Pick<TV3ChartOperationContext, "authentication" | "requestId" | "instance" | "viewAs">
): Promise<Set<string>> => {
  const ids = [...new Set(pageIds)];
  if (!access.asDashboardViewer) return new Set(ids);
  const subject = getDashboardReadSubject(context.authentication, access);
  if (!subject) return new Set();
  const principal = getDashboardReadPrincipal(context);
  const decided = await Promise.all(
    ids.map(async (pageId) => {
      const decision = await withCachedDashboardDecision(
        { dashboard, principal, decision: `page:${pageId}` },
        async () =>
          (await filterReadablePageIds(subject, [pageId])).has(pageId)
            ? { allowed: true as const }
            : problemForbidden(context.requestId, undefined, context.instance)
      );
      return decision instanceof Response ? null : pageId;
    })
  );
  return new Set(decided.filter((pageId): pageId is string => pageId !== null));
};

/**
 * A Dashboard Viewer's list (ENG-7472): `readable` keeps, of a batch of candidate dashboards, those they can
 * open with at least one page they can open — holding `chartId` on such a page when the list filters by a
 * chart — and `widgetCount` then counts only the widgets on those pages. A dashboard whose pages are all
 * limited to other teams answers 403 on read, so the list leaves it out too.
 */
export const createViewerDashboardListScope = (
  subject: TDashboardAccessSubject,
  workspaceId: string,
  chartId?: string
): {
  readable: (ids: readonly string[]) => Promise<ReadonlySet<string>>;
  widgetCount: (dashboardId: string) => number;
} => {
  const widgetCounts = new Map<string, number>();
  const readable = async (ids: readonly string[]): Promise<ReadonlySet<string>> => {
    const dashboards = await filterReadableDashboardIdsInWorkspace(subject, workspaceId, ids);
    if (dashboards.size === 0) return new Set();
    const pages = await listDashboardPageScopeRows([...dashboards], chartId);
    const openPages = await filterReadablePageIds(
      subject,
      pages.map(({ id }) => id)
    );
    const allowed = new Set<string>();
    for (const page of pages) {
      if (!openPages.has(page.id)) continue;
      widgetCounts.set(page.dashboardId, (widgetCounts.get(page.dashboardId) ?? 0) + page._count.widgets);
      if (!chartId || page.widgets.length > 0) allowed.add(page.dashboardId);
    }
    return allowed;
  };
  return { readable, widgetCount: (dashboardId) => widgetCounts.get(dashboardId) ?? 0 };
};

type TEmbeddedChartWidget = { chart: { widgets: { dashboard: { id: string } }[] } | null };

/**
 * The widgets of a read with each embedded chart's `dashboards` cut to the ones the reader can open: a
 * chart shared with a dashboard a Dashboard Viewer's team limits deny, or whose pages are all limited to
 * other teams, must not name it. "Open" is the list's test (`createViewerDashboardListScope`), so a
 * dashboard a chart names is one the reader's list shows and a read of it answers. Every other reader
 * keeps the full list.
 */
export const limitEmbeddedChartDashboards = async <TWidget extends TEmbeddedChartWidget>(
  access: TDashboardsAccessContext,
  widgets: TWidget[],
  authentication: TV3ChartOperationContext["authentication"]
): Promise<TWidget[]> => {
  if (!access.asDashboardViewer) return widgets;
  const subject = getDashboardReadSubject(authentication, access);
  const ids = [
    ...new Set(widgets.flatMap(({ chart }) => chart?.widgets.map(({ dashboard }) => dashboard.id) ?? [])),
  ];
  const readable =
    subject && ids.length > 0
      ? await createViewerDashboardListScope(subject, access.workspaceId).readable(ids)
      : new Set<string>();
  return widgets.map((widget) =>
    widget.chart
      ? {
          ...widget,
          chart: {
            ...widget.chart,
            widgets: widget.chart.widgets.filter(({ dashboard }) => readable.has(dashboard.id)),
          },
        }
      : widget
  );
};
