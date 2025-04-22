import { cache } from "@/lib/cache";
import { inviteCache } from "@/lib/cache/invite";
import { InviteWithCreator } from "@/modules/auth/signup/types/invites";
import { Prisma } from "@prisma/client";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { logger } from "@formbricks/logger";
import { DatabaseError, ResourceNotFoundError } from "@formbricks/types/errors";

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

    inviteCache.revalidate({
      id: invite.id,
      organizationId: invite.organizationId,
    });

    return true;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }
    throw new DatabaseError(error instanceof Error ? error.message : "Unknown error occurred");
  }
};

export const getInvite = reactCache(
  async (inviteId: string): Promise<InviteWithCreator | null> =>
    cache(
      async () => {
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
      },
      [`signup-getInvite-${inviteId}`],
      {
        tags: [inviteCache.tag.byId(inviteId)],
      }
    )()
);

export const getIsValidInviteToken = reactCache(
  async (inviteId: string): Promise<boolean> =>
    cache(
      async () => {
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
      },
      [`getIsValidInviteToken-${inviteId}`],
      {
        tags: [inviteCache.tag.byId(inviteId)],
      }
    )()
);
