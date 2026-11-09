import { prisma } from "@formbricks/database";
import { Prisma } from "@formbricks/database/prisma";
import { PrismaErrorType } from "@formbricks/database/types/error";
import { ResourceNotFoundError } from "@formbricks/types/errors";
import { type TInviteUpdateInput } from "@/modules/ee/role-management/types/invites";
import {
  type TInviteWriteScope,
  getInviteWriteWhere,
  getMissingInviteWriteError,
} from "@/modules/organization/settings/teams/lib/invite";

/** Only an owner may change an owner's invite: see `getInviteWriteWhere`. */
export const updateInvite = async (
  inviteId: string,
  data: TInviteUpdateInput,
  scope: TInviteWriteScope
): Promise<boolean> => {
  try {
    const invite = await prisma.invite.update({
      where: getInviteWriteWhere(inviteId, scope),
      data,
    });

    if (invite === null) {
      throw new ResourceNotFoundError("Invite", inviteId);
    }

    return true;
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === PrismaErrorType.RecordNotFound
    ) {
      throw await getMissingInviteWriteError(inviteId, scope);
    } else {
      throw error; // Re-throw any other errors
    }
  }
};
