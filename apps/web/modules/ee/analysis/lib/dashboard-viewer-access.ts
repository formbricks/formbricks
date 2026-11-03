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
