import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { Prisma } from "@formbricks/database/prisma";
import { logger } from "@formbricks/logger";
import { DatabaseError } from "@formbricks/types/errors";
import { verifyInviteToken } from "@/lib/jwt";
import { createMembership } from "@/lib/membership/service";
import { createTeamMembership } from "@/modules/auth/signup/lib/team";
import { InviteWithCreator } from "@/modules/auth/signup/types/invites";
import {
  copyInviteAttributeValuesToMembership,
  readInviteAttributeValues,
} from "@/modules/ee/member-attributes/lib/service";

/** Thrown inside the acceptance transaction to roll it back: the invite was spent, or expired, since it was checked. */
export class InviteNoLongerValidError extends Error {}

/**
 * A sign-up's invite acceptance, all or nothing: the same steps, in the same order, as the existing-account
 * acceptance (`POST /api/internal/invites/acceptances`). The invite row is locked and its Member attribute
 * values read first, so a concurrent bulk write to the invite either commits before the read or waits and
 * then fails on the spent invite's foreign key. The invite is then spent (spending it deletes its values),
 * conditioned on still existing and not having expired, and the membership, team memberships and copied
 * values are written on the same transaction, so a bulk write to the new membership can only follow the
 * copy, never be overtaken by it (ENG-7468).
 *
 * SpiceDB is not touched here: the caller projects the membership and the returned teams after the commit.
 */
export const acceptInviteInTransaction = (
  invite: InviteWithCreator,
  userId: string
): Promise<{ teamIds: string[] }> =>
  prisma.$transaction(async (tx) => {
    const attributeValues = await readInviteAttributeValues(
      { inviteId: invite.id, organizationId: invite.organizationId },
      tx
    );
    const spent = await tx.invite.deleteMany({
      where: { id: invite.id, organizationId: invite.organizationId, expiresAt: { gt: new Date() } },
    });
    if (spent.count === 0) throw new InviteNoLongerValidError();

    await createMembership(
      invite.organizationId,
      userId,
      { accepted: true, role: invite.role },
      { projection: "deferred", transaction: tx }
    );
    const teamIds =
      invite.teamIds.length > 0
        ? await createTeamMembership(
            { organizationId: invite.organizationId, role: invite.role, teamIds: invite.teamIds },
            userId,
            { projection: "deferred", transaction: tx }
          )
        : [];
    await copyInviteAttributeValuesToMembership({
      inviteId: invite.id,
      organizationId: invite.organizationId,
      userId,
      values: attributeValues,
      transaction: tx,
    });
    return { teamIds };
  });

export const getInvite = reactCache(async (inviteId: string): Promise<InviteWithCreator | null> => {
  try {
    const invite = await prisma.invite.findUnique({
      where: {
        id: inviteId,
      },
      select: {
        id: true,
        organizationId: true,
        role: true,
        teamIds: true,
        creator: {
          select: {
            name: true,
            email: true,
            locale: true,
          },
        },
      },
    });

    return invite;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }
    throw new DatabaseError(error instanceof Error ? error.message : "Unknown error occurred");
  }
});

export const getIsValidInviteToken = reactCache(async (inviteId: string): Promise<boolean> => {
  try {
    const invite = await prisma.invite.findUnique({
      where: { id: inviteId },
    });
    if (!invite) {
      return false;
    }
    if (!invite.expiresAt || isNaN(invite.expiresAt.getTime())) {
      logger.error(
        {
          inviteId,
          expiresAt: invite.expiresAt,
        },
        "SSO: Invite token expired"
      );
      return false;
    }
    if (invite.expiresAt < new Date()) {
      logger.error(
        {
          inviteId,
          expiresAt: invite.expiresAt,
        },
        "SSO: Invite token expired"
      );
      return false;
    }
    return true;
  } catch (err) {
    logger.error(err, "Error getting invite");
    return false;
  }
});

/** Outcome of matching an invite token to the address being registered. */
export type InviteMatch =
  | "valid"
  | "missing"
  | "email_mismatch"
  | "invalid_or_expired"
  | "verification_error";

/**
 * Resolve whether `inviteToken` is a valid, non-expired invite whose email matches `email`
 * (case-insensitive on both sides). Shared by the personal-email sign-up gate on the credentials and
 * SSO paths so the two can't diverge on case or validation logic. Fails closed and logs a verification
 * error, so a transient failure is observable rather than silently indistinguishable from a bad token.
 * The discriminated result lets the SSO gate map to its granular reject reasons while the credentials
 * gate just checks for `"valid"`.
 */
export const resolveInviteMatch = async (
  inviteToken: string | undefined,
  email: string
): Promise<InviteMatch> => {
  if (!inviteToken) return "missing";
  try {
    const { inviteId, email: invitedEmail } = verifyInviteToken(inviteToken);
    if (invitedEmail.trim().toLowerCase() !== email.trim().toLowerCase()) return "email_mismatch";
    return (await getIsValidInviteToken(inviteId)) ? "valid" : "invalid_or_expired";
  } catch (error) {
    logger.warn(error, "Invite token verification failed during sign-up domain check");
    return "verification_error";
  }
};
