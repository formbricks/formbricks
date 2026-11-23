import "server-only";
import { prisma } from "@formbricks/database";
import {
  type TDashboardPageProjectionRow,
  type TDashboardProjectionRow,
  teamWorkspacePairKey,
  toDashboardPageProjectionRow,
  toDashboardProjectionRow,
} from "./dashboard-relationships";

/**
 * PostgreSQL reads behind the dashboard and page projection (ADR-0060), shared by the projector
 * (`./dashboard`) and the backfill source so both derive the expected relationships from the same rows.
 *
 * Every query names its columns and reads identifiers only. Errors propagate: absence is what removes a
 * relationship, so a failed read must never be mistaken for "no row".
 */

// `@formbricks/database/prisma` re-exports only some `WhereInput` types; these are the queries' own.
type TDashboardWhere = NonNullable<NonNullable<Parameters<typeof prisma.dashboard.findMany>[0]>["where"]>;
type TDashboardPageWhere = NonNullable<
  NonNullable<Parameters<typeof prisma.dashboardPage.findMany>[0]>["where"]
>;

const teamLimitSelect = {
  team: { select: { organizationId: true } },
  teamId: true,
} as const;

/**
 * The dashboards `where` selects, as projection rows, ordered by ID. Two queries: the dashboards with
 * their `TeamDashboard` rows, then the `WorkspaceTeam` grants those selections need to count.
 */
export const readDashboardProjectionRows = async (
  where: TDashboardWhere
): Promise<ReadonlyArray<TDashboardProjectionRow>> => {
  const dashboards = await prisma.dashboard.findMany({
    where,
    select: {
      id: true,
      teamLimits: { select: teamLimitSelect, orderBy: { teamId: "asc" } },
      workspace: { select: { organizationId: true } },
      workspaceId: true,
    },
    orderBy: { id: "asc" },
  });

  const selections = dashboards.flatMap(({ teamLimits, workspaceId }) =>
    teamLimits.map(({ teamId }) => ({ teamId, workspaceId }))
  );
  const grants =
    selections.length === 0
      ? []
      : await prisma.workspaceTeam.findMany({
          where: { OR: selections },
          select: { teamId: true, workspaceId: true },
        });
  const grantedPairs = new Set(
    grants.map(({ teamId, workspaceId }) => teamWorkspacePairKey(teamId, workspaceId))
  );

  return dashboards.map(({ id, teamLimits, workspace, workspaceId }) =>
    toDashboardProjectionRow(
      { id, organizationId: workspace.organizationId, teamLimits, workspaceId },
      grantedPairs
    )
  );
};

/** The dashboard pages `where` selects, as projection rows, ordered by ID. */
export const readDashboardPageProjectionRows = async (
  where: TDashboardPageWhere
): Promise<ReadonlyArray<TDashboardPageProjectionRow>> => {
  const pages = await prisma.dashboardPage.findMany({
    where,
    select: {
      dashboard: { select: { workspace: { select: { organizationId: true } } } },
      dashboardId: true,
      id: true,
      teamLimits: { select: teamLimitSelect, orderBy: { teamId: "asc" } },
    },
    orderBy: { id: "asc" },
  });

  return pages.map(({ dashboard, dashboardId, id, teamLimits }) =>
    toDashboardPageProjectionRow({
      dashboardId,
      id,
      organizationId: dashboard.workspace.organizationId,
      teamLimits,
    })
  );
};

/**
 * Of `teamIds`, the teams with a dashboard limit (`Team.dashboardLimited`). Read from the flag, not from
 * the `TeamDashboard` rows: a limit whose dashboards were all deleted must keep the team limited.
 */
export const readDashboardLimitedTeamIds = async (
  teamIds: ReadonlyArray<string>
): Promise<ReadonlySet<string>> => {
  if (teamIds.length === 0) return new Set();
  const rows = await prisma.team.findMany({
    where: { id: { in: [...teamIds] }, dashboardLimited: true },
    select: { id: true },
  });
  return new Set(rows.map(({ id }) => id));
};

/**
 * The dashboards whose `selected_by_team` edges a `WorkspaceTeam` change can move: those of the grant's
 * workspace that the grant's team selected.
 */
export const readDashboardIdsSelectedByGrants = async (
  grants: ReadonlyArray<Readonly<{ teamId: string; workspaceId: string }>>
): Promise<ReadonlyArray<string>> => {
  if (grants.length === 0) return [];
  const rows = await prisma.teamDashboard.findMany({
    where: {
      OR: grants.map(({ teamId, workspaceId }) => ({ teamId, dashboard: { workspaceId } })),
    },
    select: { dashboardId: true },
    orderBy: { dashboardId: "asc" },
  });
  return [...new Set(rows.map(({ dashboardId }) => dashboardId))];
};
