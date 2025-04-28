import "server-only";
import { teamCache } from "@/lib/cache/team";
import { getAccessFlags } from "@/lib/membership/utils";
import { projectCache } from "@/lib/project/cache";
import { CreateMembershipInvite } from "@/modules/auth/signup/types/invites";
import { Prisma } from "@prisma/client";
import { prisma } from "@formbricks/database";
import { DatabaseError } from "@formbricks/types/errors";

export const createTeamMembership = async (invite: CreateMembershipInvite, userId: string): Promise<void> => {
  const teamIds = invite.teamIds || [];
  const userMembershipRole = invite.role;
  const { isOwner, isManager } = getAccessFlags(userMembershipRole);

  const validTeamIds: string[] = [];
  const validProjectIds: string[] = [];

  const isOwnerOrManager = isOwner || isManager;
  try {
    for (const teamId of teamIds) {
      const team = await prisma.team.findUnique({
        where: {
          id: teamId,
        },
        select: {
          projectTeams: {
            select: {
              projectId: true,
            },
          },
        },
      });

      if (team) {
        await prisma.teamUser.create({
          data: {
            teamId,
            userId,
            role: isOwnerOrManager ? "admin" : "contributor",
          },
        });

        validTeamIds.push(teamId);
        validProjectIds.push(...team.projectTeams.map((pt) => pt.projectId));
      }
    }

    for (const projectId of validProjectIds) {
      teamCache.revalidate({ id: projectId });
    }

    for (const teamId of validTeamIds) {
      teamCache.revalidate({ id: teamId });
    }

    teamCache.revalidate({ userId, organizationId: invite.organizationId });
    projectCache.revalidate({ userId, organizationId: invite.organizationId });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }

    throw error;
  }
};
