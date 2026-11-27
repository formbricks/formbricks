import "server-only";
import { prisma } from "@formbricks/database";
import type { TMemberTeam } from "./member-table";

/**
 * Each member's teams (with their team role) and each pending invite's teams, with the workspaces each
 * team reaches, for the Members table's Teams column and Member settings (ENG-7474). Read-only; the Teams
 * section stays where teams are changed. Two queries scoped by the organization, bounded by its size.
 */
export const getMemberTeamsByOrganizationId = async (
  organizationId: string
): Promise<{
  teamsByUserId: Record<string, TMemberTeam[]>;
  teamsByInviteId: Record<string, TMemberTeam[]>;
}> => {
  const [teams, invites] = await Promise.all([
    prisma.team.findMany({
      where: { organizationId },
      select: {
        id: true,
        name: true,
        teamUsers: { select: { userId: true, role: true } },
        workspaceTeams: {
          select: { permission: true, workspace: { select: { name: true } } },
          orderBy: { workspace: { name: "asc" } },
        },
      },
      orderBy: { name: "asc" },
    }),
    prisma.invite.findMany({
      where: { organizationId, acceptorId: null },
      select: { id: true, teamIds: true },
    }),
  ]);

  const teamsByUserId: Record<string, TMemberTeam[]> = {};
  const teamById = new Map<string, TMemberTeam>();
  for (const team of teams) {
    const base = {
      id: team.id,
      name: team.name,
      workspaceAccess: team.workspaceTeams.map((access) => ({
        name: access.workspace.name,
        permission: access.permission,
      })),
    };
    teamById.set(team.id, base);
    for (const teamUser of team.teamUsers) {
      teamsByUserId[teamUser.userId] ??= [];
      teamsByUserId[teamUser.userId].push({ ...base, role: teamUser.role });
    }
  }

  const teamsByInviteId: Record<string, TMemberTeam[]> = {};
  for (const invite of invites) {
    teamsByInviteId[invite.id] = invite.teamIds
      .map((teamId) => teamById.get(teamId))
      .filter((team): team is TMemberTeam => Boolean(team));
  }

  return { teamsByUserId, teamsByInviteId };
};
