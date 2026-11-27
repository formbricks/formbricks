import "server-only";
import { prisma } from "@formbricks/database";
import { can } from "@/lib/authorization";
import {
  filterReadableDashboardIds,
  filterReadableDashboardPageIds,
} from "@/lib/authorization/resource-list";

/**
 * Which dashboards and pages a principal can open (ADR-0060), decided in SpiceDB.
 *
 * Owners, Managers, Members and API keys reach every dashboard and page of a workspace they read: the
 * workspace read answers for them, on the workspace node, so a dashboard or page created a moment ago is
 * theirs at once, before the outbox projects it. A Dashboard Viewer is decided on the projected
 * `dashboard` and `dashboard_page` nodes, where team dashboard limits and page team limits live; a
 * dashboard or page the outbox has not delivered yet stays closed to them (fail closed).
 *
 * Every answer is intersected with PostgreSQL: an ID with no row is never returned, whatever the graph
 * still holds for it (a deleted dashboard's edges are hygiene, not a revocation — see the trigger
 * migration).
 *
 * The dashboard read paths' 30-second decision cache (`app/api/v3/dashboards/lib/read-decision-cache.ts`)
 * keeps only allowed decisions, keyed by principal, dashboard and its `updatedAt`. A decision built on
 * these functions inherits that window: adding a team dashboard limit or a page team limit moves neither
 * the dashboard's `updatedAt` nor the key, so a viewer who just lost a dashboard or page can keep reading
 * what the cache already allowed for up to 30 seconds — the same bound the cache already accepts for a
 * lost workspace grant. A grant is never delayed: refusals are not cached. Wiring the read paths (phase
 * 2) has to key page-bound decisions by page, or the dashboard's allow would answer for its pages.
 */

export type TDashboardAccessSubject = Readonly<{ type: "user"; id: string } | { type: "apiKey"; id: string }>;

/**
 * Of `dashboardIds` (all in `workspaceId`), the ones `subject` can open: the workspace read answers for
 * everyone but a Dashboard Viewer, who is checked in bounded bulk checks. Callers pass the candidates of
 * one list page, so the work follows the page, not the number of dashboards in the workspace.
 */
export const filterReadableDashboardIdsInWorkspace = async (
  subject: TDashboardAccessSubject,
  workspaceId: string,
  dashboardIds: readonly string[]
): Promise<Set<string>> => {
  const ids = [...new Set(dashboardIds)];
  if (ids.length === 0) return new Set();
  if (await can(subject, "workspace.read", { type: "workspace", id: workspaceId })) return new Set(ids);
  return new Set(await filterReadableDashboardIds(subject, ids));
};

/** Of `pageIds`, the dashboard pages `subject` can open, in bounded bulk checks. */
export const filterReadablePageIds = async (
  subject: TDashboardAccessSubject,
  pageIds: readonly string[]
): Promise<Set<string>> => {
  const ids = [...new Set(pageIds)];
  if (ids.length === 0) return new Set();

  const pages = await prisma.dashboardPage.findMany({
    where: { id: { in: ids } },
    select: { id: true, dashboard: { select: { workspaceId: true } } },
  });
  const workspaceIds = [...new Set(pages.map(({ dashboard }) => dashboard.workspaceId))];
  const readWorkspaces = new Set(
    (
      await Promise.all(
        workspaceIds.map(async (workspaceId) =>
          (await can(subject, "workspace.read", { type: "workspace", id: workspaceId })) ? workspaceId : null
        )
      )
    ).filter((workspaceId): workspaceId is string => workspaceId !== null)
  );

  const allowed = new Set<string>();
  const toCheck: string[] = [];
  for (const { dashboard, id } of pages) {
    if (readWorkspaces.has(dashboard.workspaceId)) allowed.add(id);
    else toCheck.push(id);
  }
  for (const id of await filterReadableDashboardPageIds(subject, toCheck)) allowed.add(id);
  return allowed;
};

/** Whether `subject` can open the dashboard (`dashboard.read`). */
export const canReadDashboard = (subject: TDashboardAccessSubject, dashboardId: string): Promise<boolean> =>
  can(subject, "dashboard.read", { type: "dashboard", id: dashboardId });

/** Whether the user can change who opens the dashboard's pages (`dashboard.manage_access`). */
export const canManageDashboardAccess = (userId: string, dashboardId: string): Promise<boolean> =>
  can({ type: "user", id: userId }, "dashboard.manage_access", { type: "dashboard", id: dashboardId });
