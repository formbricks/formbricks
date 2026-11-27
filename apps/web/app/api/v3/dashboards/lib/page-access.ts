import "server-only";
import { prisma } from "@formbricks/database";
import type { Prisma } from "@formbricks/database/prisma";
import { getV3SessionUserId } from "@/app/api/v3/lib/auth";
import { problemForbidden, problemUnprocessableContent } from "@/app/api/v3/lib/response";
import type { TV3Authentication } from "@/app/api/v3/lib/types";
import { can } from "@/lib/authorization";
import { getAccessControlPermission } from "@/modules/ee/license-check/lib/utils";

/**
 * Who decides which teams see a Dashboard page (ENG-7481). Editors build pages; only Owners and Managers
 * limit them, and only where the organization has Access Control. These are the single gate every page
 * team-limit write goes through — the page update, the whole-dashboard save — and what the app reads to
 * offer the control, so the enabled state and the check can never disagree.
 */

/**
 * Whether the caller may change the team limits of this dashboard's pages: a signed-in Owner or Manager
 * (`dashboard.manage_access`, decided in SpiceDB) of an organization with Access Control. API keys never
 * may: page limits are an access decision a person makes.
 */
export const canManageDashboardAccess = async (
  authentication: TV3Authentication,
  dashboardId: string,
  organizationId: string
): Promise<boolean> => {
  const userId = getV3SessionUserId(authentication);
  if (!userId) return false;
  const [allowed, entitled] = await Promise.all([
    can({ type: "user", id: userId }, "dashboard.manage_access", { type: "dashboard", id: dashboardId }),
    getAccessControlPermission(organizationId),
  ]);
  return allowed && entitled;
};

type TDb = Prisma.TransactionClient | typeof prisma;

/**
 * The teams a page of this dashboard can be limited to: the teams holding a grant on the dashboard's
 * workspace, except a team whose dashboard limit leaves this dashboard out — its Dashboard Viewers cannot
 * open the dashboard at all, so limiting a page to it would show nothing (D5). By name.
 */
export const getPageTeamOptions = (
  db: TDb,
  { dashboardId, workspaceId }: { dashboardId: string; workspaceId: string }
): Promise<{ id: string; name: string }[]> =>
  db.team.findMany({
    where: {
      workspaceTeams: { some: { workspaceId } },
      OR: [{ dashboardLimits: { none: {} } }, { dashboardLimits: { some: { dashboardId } } }],
    },
    orderBy: [{ name: "asc" }, { id: "asc" }],
    select: { id: true, name: true },
  });

/** Of `teamIds`, those a page of this dashboard cannot be limited to (`getPageTeamOptions`). */
export const findIneligiblePageTeams = async (
  db: TDb,
  { dashboardId, workspaceId, teamIds }: { dashboardId: string; workspaceId: string; teamIds: string[] }
): Promise<string[]> => {
  if (teamIds.length === 0) return [];
  const eligible = await db.team.findMany({
    where: {
      id: { in: teamIds },
      workspaceTeams: { some: { workspaceId } },
      OR: [{ dashboardLimits: { none: {} } }, { dashboardLimits: { some: { dashboardId } } }],
    },
    select: { id: true },
  });
  const found = new Set(eligible.map(({ id }) => id));
  return teamIds.filter((teamId) => !found.has(teamId));
};

/** 403 for a page team limit change by someone who may not limit pages. */
export const pageAccessDenied = ({ requestId, instance }: { requestId: string; instance?: string }) =>
  problemForbidden(
    requestId,
    "Only Owners and Managers can limit which teams see a page, and only with Access Control.",
    instance
  );

/** 422 naming the teams a page of this dashboard cannot be limited to. */
export const ineligiblePageTeams = (
  teamIds: string[],
  { requestId, instance }: { requestId: string; instance?: string },
  name = "teamIds"
) =>
  problemUnprocessableContent(requestId, "The teams cannot see this dashboard", {
    instance,
    invalid_params: [
      {
        name,
        reason: `These teams hold no grant on the dashboard's workspace, or their dashboard limit leaves this dashboard out: ${teamIds.join(", ")}.`,
      },
    ],
  });

/**
 * A page's team limit: `null` for none ("All teams"), or the teams it is limited to. An empty list is a
 * limit too: no team's Dashboard Viewers see the page, as when its last limited team was deleted.
 */
export type TPageTeamLimit = string[] | null;

/** A stored page's team limit, from `DashboardPage.teamLimited` and its `DashboardPageTeam` rows. */
export const storedTeamLimit = (page: {
  teamLimited: boolean;
  teamLimits: ReadonlyArray<{ teamId: string }>;
}): TPageTeamLimit =>
  page.teamLimited || page.teamLimits.length > 0 ? page.teamLimits.map(({ teamId }) => teamId) : null;

/** A team limit as the API reads it, and as the audit trail records it: `limited` and `teamIds`. */
export const toLimitFields = (limit: TPageTeamLimit): { limited: boolean; teamIds: string[] } => ({
  limited: limit !== null,
  teamIds: limit ?? [],
});

/** Whether two team limits are the same: both none, or both the same set of teams. */
export const sameTeamLimit = (a: TPageTeamLimit, b: TPageTeamLimit): boolean => {
  if (a === null || b === null) return a === b;
  const left = new Set(a);
  const right = new Set(b);
  return left.size === right.size && [...left].every((teamId) => right.has(teamId));
};

/** The teams `next` limits a page to that `before` did not; every team when the page was unlimited. */
export const addedLimitTeams = (before: TPageTeamLimit, next: TPageTeamLimit): string[] =>
  (next ?? []).filter((teamId) => !(before ?? []).includes(teamId));

/**
 * Replace a page's team limit: its `DashboardPageTeam` rows and its `teamLimited` flag, which keeps a
 * page limited to no team limited (it never reopens to every reader of its dashboard on its own).
 */
export const writePageTeamLimit = async (
  tx: Prisma.TransactionClient,
  pageId: string,
  next: TPageTeamLimit
): Promise<void> => {
  await tx.dashboardPageTeam.deleteMany({ where: { pageId } });
  if (next && next.length > 0) {
    await tx.dashboardPageTeam.createMany({ data: next.map((teamId) => ({ pageId, teamId })) });
  }
  await tx.dashboardPage.update({
    where: { id: pageId },
    data: { teamLimited: next !== null },
    select: { id: true },
  });
};
