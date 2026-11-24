import "server-only";
import { prisma } from "@formbricks/database";
import type { TOrganizationRole } from "@formbricks/types/memberships";
import { listMembersWithAttributes } from "@/modules/ee/member-attributes/lib/service";

/**
 * Who opens a dashboard, as the Access dialog and View as show it to Owners and Managers (ENG-7484).
 * Read-only: access comes from each team's workspace grant and its dashboard limit, changed in Team
 * settings.
 */

/** At most this many members are offered to View as; the picker searches within them. */
export const VIEW_AS_MEMBER_LIMIT = 250;

export type TDashboardAccessTeam = {
  id: string;
  name: string;
  permission: "read" | "readWrite" | "manage";
  /** `null`: no dashboard limit ("All dashboards"); else how many dashboards the limit names (this one too). */
  limitedDashboardCount: number | null;
  memberCount: number;
};

export type TViewAsMember = {
  userId: string;
  name: string;
  email: string;
  role: TOrganizationRole;
  attributes: { label: string; values: string[] }[];
};

/**
 * The teams with a grant on the dashboard's workspace, without those whose dashboard limit leaves this
 * dashboard out (their Dashboard Viewers cannot open it), by name.
 */
export const listDashboardAccessTeams = async (
  dashboardId: string,
  workspaceId: string
): Promise<TDashboardAccessTeam[]> => {
  const grants = await prisma.workspaceTeam.findMany({
    where: { workspaceId },
    select: {
      permission: true,
      team: {
        select: {
          id: true,
          name: true,
          dashboardLimited: true,
          _count: { select: { teamUsers: true, dashboardLimits: true } },
          dashboardLimits: { where: { dashboardId }, select: { dashboardId: true } },
        },
      },
    },
    orderBy: { team: { name: "asc" } },
  });
  return grants.flatMap(({ permission, team }) => {
    // A limited team opens only the dashboards its limit names: none when it names none (ADR-0060).
    const limited = team.dashboardLimited;
    if (limited && team.dashboardLimits.length === 0) return [];
    return [
      {
        id: team.id,
        name: team.name,
        permission,
        limitedDashboardCount: limited ? team._count.dashboardLimits : null,
        memberCount: team._count.teamUsers,
      },
    ];
  });
};

/**
 * The roles View as offers. Owners and Managers open every dashboard and page of the organization, and
 * Billing none, so viewing as them shows nothing a check is for; Members and Dashboard Viewers are who
 * team grants and dashboard limits decide.
 */
export const VIEW_AS_ROLES = ["member", "dashboard_viewer"] as const satisfies readonly TOrganizationRole[];

/** A member View as offers, and whether they open this dashboard (`false`: viewing as them shows why not). */
export type TViewAsCandidate = TViewAsMember & { hasAccess: boolean };

/**
 * Who opens `dashboardId`, by role, from the teams with a grant on its workspace: a Member through any of
 * them (dashboard limits do not apply to Members), a Dashboard Viewer only through a team without a dashboard
 * limit or whose limit names this dashboard. The same rule the reads apply (ADR-0060).
 */
const listUsersWhoOpenDashboard = async (
  dashboardId: string,
  workspaceId: string
): Promise<{ members: Set<string>; dashboardViewers: Set<string> }> => {
  const grants = await prisma.workspaceTeam.findMany({
    where: { workspaceId },
    select: {
      team: {
        select: {
          teamUsers: { select: { userId: true } },
          dashboardLimited: true,
          dashboardLimits: { where: { dashboardId }, select: { dashboardId: true } },
        },
      },
    },
  });
  const members = new Set<string>();
  const dashboardViewers = new Set<string>();
  for (const { team } of grants) {
    const opensThisDashboard = !team.dashboardLimited || team.dashboardLimits.length > 0;
    for (const { userId } of team.teamUsers) {
      members.add(userId);
      if (opensThisDashboard) dashboardViewers.add(userId);
    }
  }
  return { members, dashboardViewers };
};

/**
 * The members View as offers for `dashboardId`: Members and Dashboard Viewers, by name, with the
 * Member attributes they hold a value for and whether they open the dashboard.
 */
export const listViewAsMembers = async (
  organizationId: string,
  dashboardId: string,
  workspaceId: string
): Promise<TViewAsCandidate[]> => {
  const [members, openers] = await Promise.all([
    listMembersWithAttributes(organizationId, { limit: VIEW_AS_MEMBER_LIMIT, roles: VIEW_AS_ROLES }),
    listUsersWhoOpenDashboard(dashboardId, workspaceId),
  ]);
  return members.map(({ userId, name, email, role, attributes }) => ({
    userId,
    name,
    email,
    role,
    attributes: attributes
      .filter(({ values }) => values.length > 0)
      .map(({ label, values }) => ({ label, values })),
    hasAccess: (role === "dashboard_viewer" ? openers.dashboardViewers : openers.members).has(userId),
  }));
};

/** One member for the View as banner, or `null` when the user is not a member of the organization. */
export const getViewAsMember = async (
  organizationId: string,
  userId: string
): Promise<TViewAsMember | null> => {
  const membership = await prisma.membership.findUnique({
    where: { userId_organizationId: { userId, organizationId } },
    select: {
      role: true,
      user: { select: { name: true, email: true } },
      attributeValues: {
        select: { value: true, attributeKey: { select: { id: true, label: true } } },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      },
    },
  });
  if (!membership) return null;
  const byKey = new Map<string, { label: string; values: string[] }>();
  for (const { value, attributeKey } of membership.attributeValues) {
    const entry = byKey.get(attributeKey.id) ?? { label: attributeKey.label, values: [] };
    entry.values.push(value);
    byKey.set(attributeKey.id, entry);
  }
  return {
    userId,
    name: membership.user.name,
    email: membership.user.email,
    role: membership.role,
    attributes: [...byKey.values()],
  };
};
