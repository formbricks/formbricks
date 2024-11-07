import "server-only";
import { teamCache } from "@/lib/cache/team";
import { TOtherTeam, TUserTeam } from "@/modules/ee/teams/team-list/types/teams";
import { Prisma } from "@prisma/client";
import { cache as reactCache } from "react";
import { z } from "zod";
import { prisma } from "@formbricks/database";
import { cache } from "@formbricks/lib/cache";
import { userCache } from "@formbricks/lib/user/cache";
import { validateInputs } from "@formbricks/lib/utils/validate";
import { ZId } from "@formbricks/types/common";
import { DatabaseError, InvalidInputError, ResourceNotFoundError } from "@formbricks/types/errors";

const getUserTeams = reactCache(
  (userId: string, organizationId: string): Promise<TUserTeam[]> =>
    cache(
      async () => {
        validateInputs([userId, z.string()], [organizationId, ZId]);
        try {
          const teams = await prisma.team.findMany({
            where: {
              organizationId,
              teamUsers: {
                some: {
                  userId,
                },
              },
            },
            select: {
              id: true,
              name: true,
              teamUsers: {
                select: {
                  role: true,
                },
              },
              _count: {
                select: {
                  teamUsers: true,
                },
              },
            },
          });

          const userTeams = teams.map((team) => ({
            id: team.id,
            name: team.name,
            userRole: team.teamUsers[0].role,
            memberCount: team._count.teamUsers,
          }));

          return userTeams;
        } catch (error) {
          if (error instanceof Prisma.PrismaClientKnownRequestError) {
            throw new DatabaseError(error.message);
          }

          throw error;
        }
      },
      [`getUserTeams-${userId}`],
      {
        tags: [
          teamCache.tag.byUserId(userId),
          userCache.tag.byId(userId),
          teamCache.tag.byOrganizationId(organizationId),
        ],
      }
    )()
);

export const getOtherTeams = reactCache(
  (userId: string, organizationId: string): Promise<TOtherTeam[]> =>
    cache(
      async () => {
        validateInputs([userId, z.string()], [organizationId, ZId]);
        try {
          const teams = await prisma.team.findMany({
            where: {
              organizationId,
              teamUsers: {
                none: {
                  userId,
                },
              },
            },
            select: {
              id: true,
              name: true,
              _count: {
                select: {
                  teamUsers: true,
                },
              },
            },
          });

          const otherTeams = teams.map((team) => ({
            id: team.id,
            name: team.name,
            memberCount: team._count.teamUsers,
          }));

          return otherTeams;
        } catch (error) {
          if (error instanceof Prisma.PrismaClientKnownRequestError) {
            throw new DatabaseError(error.message);
          }

          throw error;
        }
      },
      [`getOtherTeams-${userId}`],
      {
        tags: [
          teamCache.tag.byUserId(userId),
          userCache.tag.byId(userId),
          teamCache.tag.byOrganizationId(organizationId),
        ],
      }
    )()
);

export const getTeams = reactCache(
  (userId: string, organizationId: string): Promise<{ userTeams: TUserTeam[]; otherTeams: TOtherTeam[] }> =>
    cache(
      async () => {
        const membership = await prisma.membership.findUnique({
          where: {
            userId_organizationId: {
              userId,
              organizationId,
            },
          },
          select: {
            role: true,
          },
        });

        if (!membership) {
          throw new ResourceNotFoundError("Membership", null);
        }

        const userTeams = await getUserTeams(userId, organizationId);
        let otherTeams = await getOtherTeams(userId, organizationId);

        return { userTeams, otherTeams };
      },
      [`teams-getTeams-${userId}`],
      {
        tags: [
          teamCache.tag.byUserId(userId),
          userCache.tag.byId(userId),
          teamCache.tag.byOrganizationId(organizationId),
        ],
      }
    )()
);

export const createTeam = async (organizationId: string, name: string): Promise<string> => {
  validateInputs([organizationId, ZId], [name, z.string()]);
  try {
    const doesTeamExist = await prisma.team.findFirst({
      where: {
        name,
        organizationId,
      },
    });

    if (doesTeamExist) {
      throw new InvalidInputError("Team name already exists");
    }

    if (name.length < 1) {
      throw new InvalidInputError("Team name must be at least 1 character long");
    }

    const team = await prisma.team.create({
      data: {
        name,
        organizationId,
      },
      select: {
        id: true,
      },
    });

    teamCache.revalidate({ organizationId });

    return team.id;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }

    throw error;
  }
};
