import "server-only";
import { prisma } from "@formbricks/database";
import { getIsDashboardViewerRoleEnabled } from "@/modules/ee/license-check/lib/utils";

/**
 * The one app-layer grant the Dashboard viewer holds (ADR-0018).
 *
 * `dashboard_viewer` projects to no SpiceDB relation, so SpiceDB denies it every workspace, survey,
 * response, contact and Feedback Dataset permission. Reading a dashboard is decided here instead: the
 * user holds the `dashboard_viewer` role in the workspace's organization, one of their teams is granted
 * the workspace (at any permission: a Manage grant does not widen the role), and the organization is
 * entitled to the role (Access Control and Dashboards). Nothing else grants a viewer anything, so moving
 * the role to a SpiceDB relation later deletes this module and nothing more.
 *
 * Every function answers `false` for anyone who is not a Dashboard viewer, so a caller only consults it
 * after SpiceDB has denied the request.
 */

/** A grant on the workspace through a team of the same organization, held by a viewer of that organization. */
const viewerWorkspaceGrantWhere = (userId: string, workspaceId: string) => ({
  workspaceId,
  team: {
    teamUsers: { some: { userId } },
    // The team's organization must own the workspace and hold the user as a Dashboard viewer, so a
    // cross-organization grant or a membership in another organization never admits anyone.
    organization: {
      workspaces: { some: { id: workspaceId } },
      memberships: { some: { userId, role: "dashboard_viewer" as const } },
    },
  },
});

/**
 * Whether `userId` may read the dashboards of `workspaceId` as a Dashboard viewer. Reads only: no write
 * ever admits a viewer.
 */
export const canDashboardViewerReadWorkspace = async (
  userId: string,
  workspaceId: string
): Promise<boolean> => {
  const grant = await prisma.workspaceTeam.findFirst({
    where: viewerWorkspaceGrantWhere(userId, workspaceId),
    select: { workspace: { select: { organizationId: true } } },
  });
  if (!grant) return false;

  return getIsDashboardViewerRoleEnabled(grant.workspace.organizationId);
};

/**
 * Whether a Dashboard viewer may read a Feedback Dataset's data through a dashboard of `workspaceId`:
 * they may read the workspace's dashboards, and the dataset is an active (not archived) dataset of the
 * same organization assigned to that workspace, exactly the assignment SpiceDB would check for anyone
 * else. Only the dashboard-bound reads (a saved chart's data on a dashboard, a dashboard filter's value
 * list) may ask this; the free-form chart query and field-value routes never do.
 */
export const canDashboardViewerReadFeedbackDataset = async (
  userId: string,
  workspaceId: string,
  datasetId: string
): Promise<boolean> => {
  const assignment = await prisma.feedbackDirectoryWorkspace.findFirst({
    where: {
      workspaceId,
      feedbackDirectoryId: datasetId,
      feedbackDirectory: { isArchived: false },
      workspace: { workspaceTeams: { some: viewerWorkspaceGrantWhere(userId, workspaceId) } },
    },
    select: {
      workspace: { select: { organizationId: true } },
      feedbackDirectory: { select: { organizationId: true } },
    },
  });
  if (!assignment) return false;
  if (assignment.feedbackDirectory.organizationId !== assignment.workspace.organizationId) return false;

  return getIsDashboardViewerRoleEnabled(assignment.workspace.organizationId);
};

/**
 * The workspaces of `organizationId` whose dashboards a Dashboard viewer may read, by name. Empty for
 * anyone who is not a viewer there, and for a viewer whose organization has lost the entitlement.
 */
export const listDashboardViewerWorkspaces = async (
  userId: string,
  organizationId: string
): Promise<Array<{ id: string; name: string }>> => {
  const membership = await prisma.membership.findUnique({
    where: { userId_organizationId: { userId, organizationId } },
    select: { role: true },
  });
  if (membership?.role !== "dashboard_viewer") return [];
  if (!(await getIsDashboardViewerRoleEnabled(organizationId))) return [];

  return prisma.workspace.findMany({
    where: {
      organizationId,
      workspaceTeams: { some: { team: { organizationId, teamUsers: { some: { userId } } } } },
    },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
};

/**
 * Where a Dashboard viewer stands on a workspace, for the pages: `granted` reads its dashboards,
 * `lapsed` holds a team grant but the organization lost Access Control or Dashboards (the viewer keeps
 * the role and sees the "not available on this plan" page), and `none` is anyone else: not a viewer
 * there, or a viewer none of whose teams is granted the workspace.
 */
export type TDashboardViewerWorkspaceState = "granted" | "lapsed" | "none";

export const getDashboardViewerWorkspaceState = async (
  userId: string,
  workspaceId: string
): Promise<TDashboardViewerWorkspaceState> => {
  const grant = await prisma.workspaceTeam.findFirst({
    where: viewerWorkspaceGrantWhere(userId, workspaceId),
    select: { workspace: { select: { organizationId: true } } },
  });
  if (!grant) return "none";

  return (await getIsDashboardViewerRoleEnabled(grant.workspace.organizationId)) ? "granted" : "lapsed";
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
 * a viewer in one organization and holds another role elsewhere grants as before: each operation still
 * refuses them the viewer organization's data (ADR-0018).
 */
export const isDashboardViewerOnly = async (userId: string): Promise<boolean> => {
  const memberships = await prisma.membership.findMany({ where: { userId }, select: { role: true } });
  return memberships.length > 0 && memberships.every(({ role }) => role === "dashboard_viewer");
};

/**
 * Every workspace whose dashboards `userId` may read as a Dashboard viewer, across the organizations
 * where it is one and still entitled. What `GET /api/v3/workspaces` (and the MCP `list_workspaces` tool)
 * adds for the role, so its MCP client can find the workspace ids its dashboard tools take.
 */
export const listDashboardViewerWorkspacesForUser = async (
  userId: string
): Promise<Array<{ id: string; name: string; organizationId: string }>> => {
  const organizations = await listDashboardViewerOrganizations(userId);
  const perOrganization = await Promise.all(
    organizations.map(async ({ id: organizationId }) =>
      (await listDashboardViewerWorkspaces(userId, organizationId)).map((workspace) => ({
        ...workspace,
        organizationId,
      }))
    )
  );
  return perOrganization.flat();
};
