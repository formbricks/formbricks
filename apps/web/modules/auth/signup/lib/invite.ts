import { inviteCache } from "@/lib/cache/invite";
import { InviteWithCreator } from "@/modules/auth/signup/types/invites";
import { Prisma } from "@prisma/client";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { cache } from "@formbricks/lib/cache";
import { validateInputs } from "@formbricks/lib/utils/validate";
import { ZString } from "@formbricks/types/common";
import { DatabaseError, ResourceNotFoundError } from "@formbricks/types/errors";

export const deleteInvite = async (inviteId: string): Promise<boolean> => {
  validateInputs([inviteId, ZString]);

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
        validateInputs([inviteId, ZString]);

        try {
          const invite = await prisma.invite.findUnique({
            where: {
              id: inviteId,
            },
            include: {
              creator: {
                select: {
                  name: true,
                  email: true,
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
      [`getInvite-${inviteId}`],
      {
        tags: [inviteCache.tag.byId(inviteId)],
      }
    )()
);
