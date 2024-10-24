import "server-only";
import { teamCache } from "@/app/(ee)/(teams)/lib/cache/team";
import { TTeam, ZTeam } from "@/modules/ee/teams/team-details/types/teams";
import { Prisma } from "@prisma/client";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { cache } from "@formbricks/lib/cache";
import { validateInputs } from "@formbricks/lib/utils/validate";
import { ZId } from "@formbricks/types/common";
import { DatabaseError, ResourceNotFoundError } from "@formbricks/types/errors";

export const getTeam = reactCache(
  (teamId: string): Promise<TTeam> =>
    cache(
      async () => {
        validateInputs([teamId, ZId]);
        try {
          const team = await prisma.team.findUnique({
            where: {
              id: teamId,
            },
            select: {
              id: true,
              name: true,
              teamMembers: {
                select: {
                  role: true,
                  user: {
                    select: {
                      id: true,
                      name: true,
                      email: true,
                    },
                  },
                },
              },
            },
          });

          if (!team) {
            throw new ResourceNotFoundError("team", teamId);
          }

          return {
            id: team.id,
            name: team.name,
            teamMembers: team.teamMembers.map((teamMember) => ({
              role: teamMember.role,
              id: teamMember.user.id,
              name: teamMember.user.name,
              email: teamMember.user.email,
            })),
          };
        } catch (error) {
          if (error instanceof Prisma.PrismaClientKnownRequestError) {
            throw new DatabaseError(error.message);
          }

          throw error;
        }
      },
      [`teamDetails-getTeam-${teamId}`],
      { tags: [teamCache.tag.byId(teamId)] }
    )()
);

export const updateTeamName = async (teamId: string, name: string): Promise<{ name: string }> => {
  validateInputs([teamId, ZId], [name, ZTeam.shape.name]);
  try {
    const updatedTeam = await prisma.team.update({
      where: {
        id: teamId,
      },
      data: {
        name,
      },
    });

    teamCache.revalidate({ id: teamId, organizationId: updatedTeam.organizationId });

    return { name: updatedTeam.name };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }

    throw error;
  }
};

export const deleteTeam = async (teamId: string): Promise<boolean> => {
  validateInputs([teamId, ZId]);
  try {
    const deletedTeam = await prisma.team.delete({
      where: {
        id: teamId,
      },
    });

    teamCache.revalidate({ id: teamId, organizationId: deletedTeam.organizationId });

    return true;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }

    throw error;
  }
};
