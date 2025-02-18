import { inviteCache } from "@/lib/cache/invite";
import { TInvitee } from "@/modules/setup/organization/[organizationId]/invite/types/invites";
import { Prisma } from "@prisma/client";
import { prisma } from "@formbricks/database";
import { getMembershipByUserIdOrganizationId } from "@formbricks/lib/membership/service";
import { DatabaseError, InvalidInputError } from "@formbricks/types/errors";

export const inviteUser = async ({
  invitee,
  organizationId,
  currentUserId,
}: {
  organizationId: string;
  invitee: TInvitee;
  currentUserId: string;
}): Promise<string> => {
  try {
    const { name, email } = invitee;

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

    const expiresIn = 7 * 24 * 60 * 60 * 1000; // 7 days
    const expiresAt = new Date(Date.now() + expiresIn);

    const invite = await prisma.invite.create({
      data: {
        email,
        name,
        organization: { connect: { id: organizationId } },
        creator: { connect: { id: currentUserId } },
        acceptor: user ? { connect: { id: user.id } } : undefined,
        role: "owner",
        expiresAt,
      },
    });

    inviteCache.revalidate({
      id: invite.id,
      organizationId: invite.organizationId,
    });

    return invite.id;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }

    throw error;
  }
};
