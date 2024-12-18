import "server-only";
import { teamCache } from "@/lib/cache/team";
import { Prisma } from "@prisma/client";
import { prisma } from "@formbricks/database";
import { getAccessFlags } from "@formbricks/lib/membership/utils";
import { projectCache } from "@formbricks/lib/project/cache";
import { validateInputs } from "@formbricks/lib/utils/validate";
import { ZString } from "@formbricks/types/common";
import { DatabaseError } from "@formbricks/types/errors";
import { TInvite, ZInvite } from "@formbricks/types/invites";

export const createTeamMembership = async (invite: TInvite, userId: string): Promise<void> => {
  validateInputs([invite, ZInvite], [userId, ZString]);

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
