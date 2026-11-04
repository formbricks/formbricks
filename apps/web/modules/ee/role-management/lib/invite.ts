import { prisma } from "@formbricks/database";
import { Prisma } from "@formbricks/database/prisma";
import { PrismaErrorType } from "@formbricks/database/types/error";
import { OperationNotAllowedError, ResourceNotFoundError } from "@formbricks/types/errors";
import { type TInviteUpdateInput } from "@/modules/ee/role-management/types/invites";

/**
 * Only an owner may change an owner's invite, as with an owner's membership. The rule is the write's own
 * `WHERE`, so an invite promoted to owner after the caller's checks ran is not changed either.
 */
export const updateInvite = async (
  inviteId: string,
  data: TInviteUpdateInput,
  { allowOwnerInvite }: Readonly<{ allowOwnerInvite: boolean }>
): Promise<boolean> => {
  try {
    const invite = await prisma.invite.update({
      where: allowOwnerInvite ? { id: inviteId } : { id: inviteId, role: { not: "owner" } },
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
      const exists =
        !allowOwnerInvite &&
        (await prisma.invite.findUnique({ where: { id: inviteId }, select: { id: true } })) !== null;
      if (exists) {
        throw new OperationNotAllowedError("Only owners can change the role of an owner invite");
      }
      throw new ResourceNotFoundError("Invite", inviteId);
    } else {
      throw error; // Re-throw any other errors
    }
  }
};
