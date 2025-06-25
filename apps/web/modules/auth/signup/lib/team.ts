import "server-only";
import { getAccessFlags } from "@/lib/membership/utils";
import { CreateMembershipInvite } from "@/modules/auth/signup/types/invites";
import { Prisma } from "@prisma/client";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { logger } from "@formbricks/logger";
import { DatabaseError } from "@formbricks/types/errors";

export const createTeamMembership = async (invite: CreateMembershipInvite, userId: string): Promise<void> => {
  const teamIds = invite.teamIds || [];

  const userMembershipRole = invite.role;
  const { isOwner, isManager } = getAccessFlags(userMembershipRole);

  const isOwnerOrManager = isOwner || isManager;
  try {
    for (const teamId of teamIds) {
      const team = await getTeamProjectIds(teamId, invite.organizationId);

      if (team) {
        await prisma.teamUser.create({
          data: {
            teamId,
            userId,
            role: isOwnerOrManager ? "admin" : "contributor",
          },
        });
      }
    }
  } catch (error) {
    logger.error(error, `Error creating team membership ${invite.organizationId} ${userId}`);
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }

    throw error;
  }
};

export const getTeamProjectIds = reactCache(
  async (teamId: string, organizationId: string): Promise<{ projectTeams: { projectId: string }[] }> => {
    const team = await prisma.team.findUnique({
      where: {
        id: teamId,
        organizationId,
      },
      select: {
        projectTeams: {
          select: {
            projectId: true,
          },
        },
      },
    });

    if (!team) {
      throw new Error("Team not found");
    }

    return team;
  }
);
