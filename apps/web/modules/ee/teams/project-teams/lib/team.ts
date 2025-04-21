import "server-only";
import { cache } from "@/lib/cache";
import { teamCache } from "@/lib/cache/team";
import { projectCache } from "@/lib/project/cache";
import { validateInputs } from "@/lib/utils/validate";
import { TProjectTeam } from "@/modules/ee/teams/project-teams/types/team";
import { Prisma } from "@prisma/client";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { ZId } from "@formbricks/types/common";
import { DatabaseError, ResourceNotFoundError } from "@formbricks/types/errors";

export const getTeamsByProjectId = reactCache(
  async (projectId: string): Promise<TProjectTeam[] | null> =>
    cache(
      async () => {
        validateInputs([projectId, ZId]);
        try {
          const project = await prisma.project.findUnique({
            where: {
              id: projectId,
            },
          });

          if (!project) {
            throw new ResourceNotFoundError("Project", projectId);
          }

          const teams = await prisma.team.findMany({
            where: {
              projectTeams: {
                some: {
                  projectId: projectId,
                },
              },
            },
            select: {
              id: true,
              name: true,
              projectTeams: {
                where: {
                  projectId: projectId,
                },
                select: {
                  permission: true,
                },
              },
              _count: {
                select: {
                  teamUsers: true,
                },
              },
            },
          });

          const projectTeams = teams.map((team) => ({
            id: team.id,
            name: team.name,
            permission: team.projectTeams[0].permission,
            memberCount: team._count.teamUsers,
          }));

          return projectTeams;
        } catch (error) {
          if (error instanceof Prisma.PrismaClientKnownRequestError) {
            throw new DatabaseError(error.message);
          }

          throw error;
        }
      },
      [`getTeamsByProjectId-${projectId}`],
      {
        tags: [teamCache.tag.byProjectId(projectId), projectCache.tag.byId(projectId)],
      }
    )()
);
