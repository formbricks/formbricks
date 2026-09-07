import "server-only";
import { prisma } from "@formbricks/database";
import { Prisma } from "@formbricks/database/prisma";
import { DatabaseError } from "@formbricks/types/errors";
import { runPostCommitProjection } from "@/lib/authzed/projection-boundary";
import { reconcileTeamWorkspaceRelationships } from "@/lib/authzed/team-workspace";
import { getAccessFlags } from "@/lib/membership/utils";
import { CreateMembershipInvite } from "@/modules/auth/invite/types/invites";

export const createTeamMembership = async (invite: CreateMembershipInvite, userId: string): Promise<void> => {
  const teamIds = invite.teamIds || [];
  const userMembershipRole = invite.role;
  const { isOwner, isManager } = getAccessFlags(userMembershipRole);

  const committedTeamIds: string[] = [];

  const isOwnerOrManager = isOwner || isManager;
  try {
    for (const teamId of teamIds) {
      const team = await prisma.team.findUnique({
        where: {
          id: teamId,
        },
        select: {
          id: true,
        },
      });

      if (team) {
        await prisma.teamUser.upsert({
          create: {
            teamId,
            userId,
            role: isOwnerOrManager ? "admin" : "contributor",
          },
          update: {
            role: isOwnerOrManager ? "admin" : "contributor",
          },
          where: {
            teamId_userId: {
              teamId,
              userId,
            },
          },
        });

        committedTeamIds.push(teamId);
      }
    }
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }

    throw error;
  } finally {
    await runPostCommitProjection("invite_team_membership_create", () =>
      reconcileTeamWorkspaceRelationships({
        teamMemberships: committedTeamIds.map((teamId) => ({ teamId, userId })),
      })
    );
  }
};
