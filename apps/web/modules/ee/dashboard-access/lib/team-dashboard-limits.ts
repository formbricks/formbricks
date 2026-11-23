import "server-only";
import { prisma } from "@formbricks/database";
import type { Prisma } from "@formbricks/database/prisma";

/**
 * A team's dashboard limits (ENG-7483, ADR-0059): the dashboards its Dashboard Viewer members open in the
 * workspaces the team is granted. No rows means every dashboard there ("All dashboards"). Only members
 * whose organization role is Dashboard Viewer are narrowed; SpiceDB decides it from the projected rows.
 */

/** At most this many dashboards in one team's limit. */
export const TEAM_DASHBOARD_LIMIT_MAX = 200;

export type TTeamDashboardOption = {
  id: string;
  name: string;
  workspaceId: string;
  workspaceName: string;
};

export type TTeamDashboardLimits = {
  teamId: string;
  /**
   * Whether the team's Dashboard Viewers are limited to `dashboardIds`. True with no `dashboardIds` when
   * every selected dashboard was deleted: the team then reaches no dashboard (fail closed).
   */
  limited: boolean;
  /** The selected dashboards; empty while `limited` is false means every dashboard of the team's workspaces. */
  dashboardIds: string[];
};

export class TeamDashboardLimitsInvalidError extends Error {
  constructor(readonly dashboardIds: string[]) {
    super("Some dashboards are not in a workspace the team is granted");
    this.name = "TeamDashboardLimitsInvalidError";
  }
}

/** The organization a team belongs to, or `null` for none. */
export const getTeamOrganizationId = async (teamId: string): Promise<string | null> =>
  (await prisma.team.findUnique({ where: { id: teamId }, select: { organizationId: true } }))
    ?.organizationId ?? null;

export const getTeamDashboardLimits = async (
  organizationId: string,
  teamId: string
): Promise<TTeamDashboardLimits | null> => {
  const team = await prisma.team.findFirst({
    where: { id: teamId, organizationId },
    select: {
      id: true,
      dashboardLimited: true,
      dashboardLimits: {
        select: { dashboardId: true },
        orderBy: { dashboardId: "asc" },
        take: TEAM_DASHBOARD_LIMIT_MAX,
      },
    },
  });
  return team
    ? {
        teamId: team.id,
        limited: team.dashboardLimited,
        dashboardIds: team.dashboardLimits.map(({ dashboardId }) => dashboardId),
      }
    : null;
};

/** The dashboards a team's limit can name: those of the workspaces the team is granted, by name. */
export const listTeamDashboardOptions = async (
  organizationId: string,
  teamId: string
): Promise<TTeamDashboardOption[]> => {
  const dashboards = await prisma.dashboard.findMany({
    where: { workspace: { organizationId, workspaceTeams: { some: { teamId } } } },
    select: { id: true, name: true, workspace: { select: { id: true, name: true } } },
    orderBy: [{ workspace: { name: "asc" } }, { name: "asc" }],
    take: 1000,
  });
  return dashboards.map(({ id, name, workspace }) => ({
    id,
    name,
    workspaceId: workspace.id,
    workspaceName: workspace.name,
  }));
};

/**
 * Replaces the team's dashboard limits. Every dashboard must sit in a workspace the team is granted.
 * Returns the limits before and after, for the audit trail; `null` when the team is not the
 * organization's.
 */
export const replaceTeamDashboardLimits = async (
  organizationId: string,
  teamId: string,
  dashboardIds: readonly string[]
): Promise<{ before: TTeamDashboardLimits; after: TTeamDashboardLimits } | null> => {
  const ids = [...new Set(dashboardIds)];
  return prisma.$transaction(async (tx) => {
    const before = await tx.team.findFirst({
      where: { id: teamId, organizationId },
      select: {
        dashboardLimited: true,
        dashboardLimits: { select: { dashboardId: true }, orderBy: { dashboardId: "asc" } },
      },
    });
    if (!before) return null;

    if (ids.length > 0) {
      const eligible = new Set(
        (
          await tx.dashboard.findMany({
            where: { id: { in: ids }, workspace: { organizationId, workspaceTeams: { some: { teamId } } } },
            select: { id: true },
          })
        ).map(({ id }) => id)
      );
      const refused = ids.filter((id) => !eligible.has(id));
      if (refused.length > 0) throw new TeamDashboardLimitsInvalidError(refused);
    }

    const previous = before.dashboardLimits.map(({ dashboardId }) => dashboardId);
    const removed = previous.filter((id) => !ids.includes(id));
    const added = ids.filter((id) => !previous.includes(id));
    if (removed.length > 0) {
      await tx.teamDashboard.deleteMany({ where: { teamId, dashboardId: { in: removed } } });
    }
    if (added.length > 0) {
      await tx.teamDashboard.createMany({ data: added.map((dashboardId) => ({ teamId, dashboardId })) });
    }
    const limited = ids.length > 0;
    if (before.dashboardLimited !== limited) {
      await tx.team.update({ where: { id: teamId }, data: { dashboardLimited: limited } });
    }
    return {
      before: { teamId, limited: before.dashboardLimited, dashboardIds: previous },
      after: { teamId, limited, dashboardIds: [...ids].sort((a, b) => a.localeCompare(b)) },
    };
  });
};

/**
 * Removes a team's dashboard limits in workspaces it loses its grant on, in the transaction that
 * removes the grant: a limit naming a dashboard the team no longer reaches would otherwise come back
 * if the grant is given again.
 */
export const deleteTeamDashboardLimitsInWorkspaces = async (
  tx: Prisma.TransactionClient,
  teamId: string,
  workspaceIds: readonly string[]
): Promise<void> => {
  if (workspaceIds.length === 0) return;
  await tx.teamDashboard.deleteMany({
    where: { teamId, dashboard: { workspaceId: { in: [...workspaceIds] } } },
  });
};
