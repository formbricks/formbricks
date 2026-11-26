import "server-only";
import { prisma } from "@formbricks/database";
import { Prisma } from "@formbricks/database/prisma";
import { DatabaseError } from "@formbricks/types/errors";
import type { TOrganizationRole } from "@formbricks/types/memberships";
import { reconcileOrganizationMembership } from "@/lib/authzed/organization-membership";
import { CreateMembershipInvite } from "@/modules/auth/invite/types/invites";
import { createTeamMembership } from "@/modules/auth/signup/lib/team";

/**
 * Creates the organization membership if the user has none, and returns the role they hold afterwards.
 *
 * Create-only on purpose: `skipDuplicates` turns an existing row, including one a concurrent request
 * wrote after any read we could have made first, into a no-op instead of an update. The stored role is
 * never overwritten, and reading it back gives the role the user really holds.
 */
const createMembershipIfMissing = async (
  organizationId: string,
  userId: string,
  role: TOrganizationRole
): Promise<TOrganizationRole> => {
  try {
    await prisma.membership.createMany({
      data: [{ organizationId, userId, accepted: true, role }],
      skipDuplicates: true,
    });
    const membership = await prisma.membership.findUnique({
      where: { userId_organizationId: { userId, organizationId } },
      select: { role: true },
    });
    return membership?.role ?? role;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }
    throw error;
  }
};

/**
 * Gives the user the organization membership and team memberships an invite grants.
 *
 * An invite only creates a membership. A user who is already a member keeps their role, so a stale
 * invite cannot lower it, an owner's included (ENG-7097). Their team memberships follow the role they
 * actually hold, not the invite's.
 */
export const acceptInviteMembership = async (
  invite: CreateMembershipInvite,
  userId: string
): Promise<void> => {
  const role = await createMembershipIfMissing(invite.organizationId, userId, invite.role);

  // On every acceptance, not only on a create: a retry then heals a relationship an earlier attempt
  // committed to the database but failed to project.
  await reconcileOrganizationMembership(invite.organizationId, userId);

  if (invite.teamIds) {
    await createTeamMembership(
      { organizationId: invite.organizationId, role, teamIds: invite.teamIds },
      userId
    );
  }
};
