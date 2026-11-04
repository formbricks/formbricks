import "server-only";
import { prisma } from "@formbricks/database";
import { can } from "@/lib/authorization";
import { lookupAuthorizedWorkspaceIds } from "@/lib/authorization/resource-list";
import { isOnlyDashboardViewer } from "@/lib/membership/dashboard-viewer";
import { getMembershipByUserIdOrganizationId } from "@/lib/membership/service";
import { getIsDashboardViewerRoleEnabled } from "@/modules/ee/license-check/lib/utils";

/**
 * Where the pages and lists find a Dashboard viewer's dashboards (ADR-0025).
 *
 * The role is a SpiceDB relation (`organization#dashboard_viewer`), and every decision here comes from
 * SpiceDB: `workspace.dashboard_read`, which a viewer holds through the team grants of the workspaces
 * its teams reach, at any level (a Manage grant does not widen the role). Nothing here grants anything.
 * What stays in PostgreSQL is who holds the role (to route a viewer to its dashboards) and the
 * entitlement (Access Control and Dashboards): a lapsed plan keeps the role and locks the viewer out.
 */

const isDashboardViewerIn = async (userId: string, organizationId: string): Promise<boolean> =>
  (await getMembershipByUserIdOrganizationId(userId, organizationId))?.role === "dashboard_viewer";

/**
 * The workspaces of `organizationId` whose dashboards a Dashboard viewer may read, by name. Empty for
 * anyone who is not a viewer there, and for a viewer whose organization has lost the entitlement.
 */
export const listDashboardViewerWorkspaces = async (
  userId: string,
  organizationId: string
): Promise<Array<{ id: string; name: string }>> => {
  if (!(await isDashboardViewerIn(userId, organizationId))) return [];
  if (!(await getIsDashboardViewerRoleEnabled(organizationId))) return [];

  const workspaceIds = await lookupAuthorizedWorkspaceIds({ type: "user", id: userId }, "dashboard_read");
  if (workspaceIds.length === 0) return [];

  return prisma.workspace.findMany({
    where: { organizationId, id: { in: [...workspaceIds] } },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
};

/**
 * Where a Dashboard viewer stands on a workspace, for the pages: `granted` reads its dashboards,
 * `lapsed` may read them but the organization lost Access Control or Dashboards (the viewer keeps the
 * role and sees the "not available on this plan" page), and `none` is anyone else: not a viewer
 * there, or a viewer SpiceDB denies the workspace's dashboards.
 */
export type TDashboardViewerWorkspaceState = "granted" | "lapsed" | "none";

export const getDashboardViewerWorkspaceState = async (
  userId: string,
  workspaceId: string
): Promise<TDashboardViewerWorkspaceState> => {
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { organizationId: true },
  });
  if (!workspace || !(await isDashboardViewerIn(userId, workspace.organizationId))) return "none";

  const allowed = await can({ type: "user", id: userId }, "workspace.dashboard_read", {
    type: "workspace",
    id: workspaceId,
  });
  if (!allowed) return "none";

  return (await getIsDashboardViewerRoleEnabled(workspace.organizationId)) ? "granted" : "lapsed";
};

/** The organizations where `userId` holds the Dashboard viewer role, entitled or not, by name. */
export const listDashboardViewerOrganizations = async (
  userId: string
): Promise<Array<{ id: string; name: string }>> =>
  prisma.organization.findMany({
    where: { memberships: { some: { userId, role: "dashboard_viewer" } } },
    select: { id: true, name: true },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });

/** The page a Dashboard viewer can't reach a workspace from: no granted workspace, or a lapsed plan. */
export const getDashboardViewerUnavailablePath = (organizationId: string): string =>
  `/organizations/${organizationId}/dashboards-unavailable`;

/**
 * Where a Dashboard viewer lands in an organization: the dashboard list of `preferredWorkspaceId` when
 * they may read it (the last-used workspace), else of their first granted workspace, else the
 * unavailable page, which explains a lapsed plan or a missing team grant.
 */
export const getDashboardViewerHomePath = async (
  userId: string,
  organizationId: string,
  preferredWorkspaceId?: string
): Promise<string> => {
  const workspaces = await listDashboardViewerWorkspaces(userId, organizationId);
  const target = workspaces.find(({ id }) => id === preferredWorkspaceId) ?? workspaces[0];
  return target ? `/workspaces/${target.id}/dashboards` : getDashboardViewerUnavailablePath(organizationId);
};

/**
 * Whether every organization membership `userId` holds is the Dashboard viewer role. Such a user can
 * only ever read dashboards, so an OAuth grant they give is limited to `dashboards:read`. A user who is
 * a viewer in one organization and holds another role elsewhere grants as before: SpiceDB still
 * refuses them everything but dashboard reads in the viewer organization (ADR-0025).
 */
export const isDashboardViewerOnly = async (userId: string): Promise<boolean> =>
  isOnlyDashboardViewer(prisma, userId);

/**
 * Every workspace whose dashboards `userId` may read as a Dashboard viewer, across the organizations
 * where it is one and still entitled. What `GET /api/v3/workspaces` (and the MCP `list_workspaces` tool)
 * adds for the role, so its MCP client can find the workspace ids its dashboard tools take.
 */
export const listDashboardViewerWorkspacesForUser = async (
  userId: string
): Promise<Array<{ id: string; name: string; organizationId: string }>> => {
  // One SpiceDB lookup and one workspace query for every viewer organization at once (C12): the landing
  // page and `GET /api/v3/workspaces` call this, and a per-organization loop made both N+1.
  const organizations = await listDashboardViewerOrganizations(userId);
  if (organizations.length === 0) return [];

  const [entitled, workspaceIds] = await Promise.all([
    Promise.all(
      organizations.map(async ({ id }) => ((await getIsDashboardViewerRoleEnabled(id)) ? id : null))
    ),
    lookupAuthorizedWorkspaceIds({ type: "user", id: userId }, "dashboard_read"),
  ]);
  const organizationIds = entitled.filter((id): id is string => id !== null);
  if (organizationIds.length === 0 || workspaceIds.length === 0) return [];

  return prisma.workspace.findMany({
    where: { organizationId: { in: organizationIds }, id: { in: [...workspaceIds] } },
    select: { id: true, name: true, organizationId: true },
    orderBy: [{ organizationId: "asc" }, { name: "asc" }],
  });
};
