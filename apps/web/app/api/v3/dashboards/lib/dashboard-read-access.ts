import "server-only";
import type { TV3ChartOperationContext } from "@/app/api/v3/charts/lib/access";
import { type TDashboardsAccessContext, getDashboardReadSubject } from "@/app/api/v3/lib/dashboards-access";
import { problemForbidden } from "@/app/api/v3/lib/response";
import { canReadDashboard, filterReadablePageIds } from "@/modules/ee/dashboard-access/lib/spicedb-access";
import { getDashboardReadPrincipal, withCachedDashboardDecision } from "./read-decision-cache";

/**
 * Which dashboards and pages a dashboard-bound read reaches (ENG-7472, ADR-0059). Owners, Managers,
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
  { authentication, requestId, instance }: Pick<TV3ChartOperationContext, "authentication" | "requestId" | "instance">
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
