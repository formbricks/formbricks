import "server-only";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { Prisma } from "@formbricks/database/prisma";
import { ZId } from "@formbricks/types/common";
import { DatabaseError } from "@formbricks/types/errors";
import { validateInputs } from "@/lib/utils/validate";
import type { TTeamRole } from "@/modules/ee/teams/team-list/types/team";
import type { TTeamPermission } from "@/modules/ee/teams/workspace-teams/types/team";

export const TEAM_DIRECTORY_LIMIT = 200;

export interface TTeamListItem {
  id: string;
  name: string;
  memberCount: number;
  /** The viewer's role in this team; `null` when they are not in it. */
  viewerRole: TTeamRole | null;
  access: { workspaceId: string; workspaceName: string; permission: TTeamPermission }[];
}

/**
 * The teams list in one query: member count, workspace access and the viewer's own role in each team, so
 * a row never triggers another read. The full member list of a team is loaded when its dialog opens.
 */
export const getTeamDirectory = reactCache(
  async (organizationId: string, viewerId: string): Promise<TTeamListItem[]> => {
    validateInputs([organizationId, ZId], [viewerId, ZId]);

    try {
      const teams = await prisma.team.findMany({
        where: { organizationId },
        select: {
          id: true,
          name: true,
          _count: { select: { teamUsers: true } },
          teamUsers: { where: { userId: viewerId }, select: { role: true } },
          workspaceTeams: {
            select: { permission: true, workspace: { select: { id: true, name: true } } },
          },
        },
        orderBy: { name: "asc" },
        take: TEAM_DIRECTORY_LIMIT,
      });

      return teams.map((team) => ({
        id: team.id,
        name: team.name,
        memberCount: team._count.teamUsers,
        viewerRole: team.teamUsers[0]?.role ?? null,
        access: team.workspaceTeams
          .map(({ permission, workspace }) => ({
            workspaceId: workspace.id,
            workspaceName: workspace.name,
            permission,
          }))
          .sort((a, b) => a.workspaceName.localeCompare(b.workspaceName, undefined, { sensitivity: "base" })),
      }));
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        throw new DatabaseError(error.message);
      }
      throw error;
    }
  }
);
