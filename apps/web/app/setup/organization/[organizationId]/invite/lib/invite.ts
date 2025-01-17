import { TInvitee, ZInvitee } from "@/app/setup/organization/[organizationId]/invite/types/invites";
import { inviteCache } from "@/lib/cache/invite";
import { Invite, Prisma } from "@prisma/client";
import { prisma } from "@formbricks/database";
import { getMembershipByUserIdOrganizationId } from "@formbricks/lib/membership/service";
import { validateInputs } from "@formbricks/lib/utils/validate";
import { ZString } from "@formbricks/types/common";
import { DatabaseError, InvalidInputError, ValidationError } from "@formbricks/types/errors";

export const inviteUser = async ({
  invitee,
  organizationId,
  currentUserId,
}: {
  organizationId: string;
  invitee: TInvitee;
  currentUserId: string;
}): Promise<Pick<Invite, "id">> => {
  validateInputs([organizationId, ZString], [invitee, ZInvitee]);

  try {
    const { name, email, role, teamIds } = invitee;

    const existingInvite = await prisma.invite.findFirst({ where: { email, organizationId } });

    if (existingInvite) {
      throw new InvalidInputError("Invite already exists");
    }

    const user = await prisma.user.findUnique({ where: { email } });

    if (user) {
      const member = await getMembershipByUserIdOrganizationId(user.id, organizationId);

      if (member) {
        throw new InvalidInputError("User is already a member of this organization");
      }
    }

    const teamIdsSet = new Set(teamIds);

    if (teamIdsSet.size !== teamIds.length) {
      throw new ValidationError("teamIds must be unique");
    }

    const teams = await prisma.team.findMany({
      where: {
        id: { in: teamIds },
        organizationId,
      },
    });

    if (teams.length !== teamIds.length) {
      throw new ValidationError("Invalid teamIds");
    }

    const expiresIn = 7 * 24 * 60 * 60 * 1000; // 7 days
    const expiresAt = new Date(Date.now() + expiresIn);

    const invite = await prisma.invite.create({
      data: {
        email,
        name,
        organization: { connect: { id: organizationId } },
        creator: { connect: { id: currentUserId } },
        acceptor: user ? { connect: { id: user.id } } : undefined,
        role,
        expiresAt,
        teamIds: { set: teamIds },
      },
    });

    inviteCache.revalidate({
      id: invite.id,
      organizationId: invite.organizationId,
    });

    return { id: invite.id };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }

    throw error;
  }
};
