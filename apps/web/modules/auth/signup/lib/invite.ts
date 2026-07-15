import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { Prisma } from "@formbricks/database/prisma";
import { logger } from "@formbricks/logger";
import { DatabaseError, ResourceNotFoundError } from "@formbricks/types/errors";
import { verifyInviteToken } from "@/lib/jwt";
import { InviteWithCreator } from "@/modules/auth/signup/types/invites";

export const deleteInvite = async (inviteId: string): Promise<boolean> => {
  try {
    const invite = await prisma.invite.delete({
      where: {
        id: inviteId,
      },
      select: {
        id: true,
        organizationId: true,
      },
    });

    if (!invite) {
      throw new ResourceNotFoundError("Invite", inviteId);
    }

    return true;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }
    throw new DatabaseError(error instanceof Error ? error.message : "Unknown error occurred");
  }
};

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
