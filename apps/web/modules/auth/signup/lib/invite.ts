import { inviteCache } from "@/lib/cache/invite";
import { InviteWithCreator } from "@/modules/auth/signup/types/invites";
import { Prisma } from "@prisma/client";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { cache } from "@formbricks/lib/cache";
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

    throw error;
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

          throw error;
        }
      },
      [`signup-getInvite-${inviteId}`],
      {
        tags: [inviteCache.tag.byId(inviteId)],
      }
    )()
);
