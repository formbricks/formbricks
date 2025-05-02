import { Prisma } from "@prisma/client";
import { prisma } from "@formbricks/database";
import { getMembershipByUserIdOrganizationId } from "@formbricks/lib/membership/service";
import { getAccessFlags } from "@formbricks/lib/membership/utils";
import { AuthorizationError, DatabaseError, InvalidInputError } from "@formbricks/types/errors";
import { TUserWhitelistInfo } from "@formbricks/types/user";

const whitelistSelection = {
  id: true,
  email: true,
  name: true,
  whitelist: true,
};
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

export const removeUserFromWhitelist = async ({
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
      throw new AuthorizationError("Current user does not have permissions to remove from whitelist");
    }
    const userToRemoveFromWhitelist = await prisma.user.findUnique({
      where: { email },
      select: { id: true, whitelist: true },
    });

    // Check if user does not exist or already whitelisted
    if (!userToRemoveFromWhitelist) {
      throw new InvalidInputError("User with such email does not exist!");
    }

    if (!userToRemoveFromWhitelist.whitelist) {
      throw new InvalidInputError("User is already not whitelisted");
    }

    // Remove user from whitelist
    const unWhitelistedUser = await prisma.user.update({
      where: {
        id: userToRemoveFromWhitelist.id,
      },
      data: {
        whitelist: false,
      },
    });

    return unWhitelistedUser.id;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }

    throw error;
  }
};

export const getNonWhitelistedUsers = async (): Promise<TUserWhitelistInfo[]> => {
  try {
    const nonWhitelistedUsers = await prisma.user.findMany({
      where: {
        whitelist: false,
      },
      select: whitelistSelection,
    });
    return nonWhitelistedUsers;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }
    return [];
  }
};

export const getWhitelistedUsers = async (): Promise<TUserWhitelistInfo[]> => {
  try {
    const whitelistedUsers = await prisma.user.findMany({
      where: {
        whitelist: true,
      },
      select: whitelistSelection,
    });
    return whitelistedUsers;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }
    return [];
  }
};
