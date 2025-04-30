import { inviteCache } from "@/lib/cache/invite";
import { Prisma } from "@prisma/client";
import { prisma } from "@formbricks/database";
import { getMembershipByUserIdOrganizationId } from "@formbricks/lib/membership/service";
import { getAccessFlags } from "@formbricks/lib/membership/utils";
import { responseSelection } from "@formbricks/lib/response/service";
import {
  AuthorizationError,
  DatabaseError,
  InvalidInputError,
  ResourceNotFoundError,
} from "@formbricks/types/errors";
import { TUser } from "@formbricks/types/user";

export const addUserToWhitelist = async ({
  email,
  organizationId,
  currentUserId,
}: {
  email: string;
  organizationId: string;
  currentUserId: string;
}): Promise<string> => {
  try {
    // Check if current user is owner or manager
    const currentUserMembership = await getMembershipByUserIdOrganizationId(currentUserId, organizationId);
    const { isOwner, isManager } = getAccessFlags(currentUserMembership?.role);
    const isOwnerOrManager = isOwner || isManager;

    if (!isOwnerOrManager) {
      throw new AuthorizationError("Current user does not have permissions to whitelist");
    }
    const userToWhitelist = await prisma.user.findUnique({
      where: { email },
      select: { id: true, whitelist: true },
    });

    // Check if user does not exist or already whitelisted
    if (!userToWhitelist) {
      throw new InvalidInputError("User with such email does not exist!");
    }

    if (userToWhitelist.whitelist) {
      throw new InvalidInputError("User is already whitelisted");
    }

    // Whitelist user
    const whitelistUser = await prisma.user.update({
      where: {
        id: userToWhitelist.id,
      },
      data: {
        whitelist: true,
      },
    });

    return whitelistUser.id;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }

    throw error;
  }
};

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

export const getNonWhitelistedUsers = async (): Promise<TUser[] | null> => {
  try {
    const nonWhitelistedUsers = await prisma.user.findMany({
      where: {
        whitelist: false,
      },
      select: responseSelection,
    });

    if (!nonWhitelistedUsers) {
      return null;
    }

    return nonWhitelistedUsers;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }

    throw error;
  }
};
