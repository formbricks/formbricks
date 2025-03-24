import { inviteCache } from "@/lib/cache/invite";
import { type TInviteUpdateInput } from "@/modules/ee/role-management/types/invites";
import { Prisma } from "@prisma/client";
import { prisma } from "@formbricks/database";
import { PrismaErrorType } from "@formbricks/database/types/error";
import { ResourceNotFoundError } from "@formbricks/types/errors";

export const updateInvite = async (inviteId: string, data: TInviteUpdateInput): Promise<boolean> => {
  try {
    const invite = await prisma.invite.update({
      where: { id: inviteId },
      data,
    });

    if (invite === null) {
      throw new ResourceNotFoundError("Invite", inviteId);
    }

    inviteCache.revalidate({
      id: invite.id,
      organizationId: invite.organizationId,
    });

    return true;
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === PrismaErrorType.RecordDoesNotExist
    ) {
      throw new ResourceNotFoundError("Invite", inviteId);
    } else {
      throw error; // Re-throw any other errors
    }
  }
};
