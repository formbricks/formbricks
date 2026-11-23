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
          _count: { select: { teamUsers: true, dashboardLimits: true } },
          dashboardLimits: { where: { dashboardId }, select: { dashboardId: true } },
        },
      },
    },
    orderBy: { team: { name: "asc" } },
  });
  return grants.flatMap(({ permission, team }) => {
    const limited = team._count.dashboardLimits > 0;
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

/** The organization's members View as offers, with their Member attributes, by name. */
export const listViewAsMembers = async (organizationId: string): Promise<TViewAsMember[]> =>
  (await listMembersWithAttributes(organizationId, { limit: VIEW_AS_MEMBER_LIMIT })).map(
    ({ userId, name, email, role, attributes }) => ({
      userId,
      name,
      email,
      role,
      attributes: attributes
        .filter(({ values }) => values.length > 0)
        .map(({ label, values }) => ({ label, values })),
    })
  );

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
