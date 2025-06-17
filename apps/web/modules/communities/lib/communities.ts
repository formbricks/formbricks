import { whitelistSelection } from "@/modules/organization/settings/whitelist/lib/whitelist";
import { Prisma } from "@prisma/client";
import { prisma } from "@formbricks/database";
import { DatabaseError, InvalidInputError } from "@formbricks/types/errors";
import { TUserWhitelistInfo } from "@formbricks/types/user";

// const userCommunitySelection = {
//     id: true,
//     user: true,
//     creator: true
//   };

export const addUserCommunity = async ({
  // May need to add auth to verify user
  userId,
  creatorId,
}: {
  userId: string;
  creatorId: string;
}): Promise<string> => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, whitelist: true }, // Need to modify to return other data
    });

    // Check if user exists
    if (!user) {
      throw new InvalidInputError("User does not exist!");
    }

    const creator = await prisma.user.findUnique({
      where: { id: creatorId },
      select: { id: true, whitelist: true },
    });

    // Check if creator exists
    if (!creator) {
      throw new InvalidInputError("Creator does not exist!");
    }

    // Add user community
    const userCommunity = await prisma.userCommunity.create({
      data: {
        userId: user.id,
        creatorId: creatorId,
      },
    });

    return userCommunity.id;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }

    throw error;
  }
};

export const removeUserCommunity = async ({
  // May need to add auth to verify user
  userId,
  creatorId,
}: {
  userId: string;
  creatorId: string;
}): Promise<string> => {
  try {
    // Delete user community
    const deletedUserCommunity = await prisma.userCommunity.delete({
      where: {
        userId_creatorId: {
          userId: userId,
          creatorId: creatorId,
        },
      },
    });

    return deletedUserCommunity.id;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }

    throw error;
  }
};

export const getCurrentUserCommunities = async ({
  userId,
  query,
}: {
  userId: string;
  query?: string;
}): Promise<TUserWhitelistInfo[]> => {
  try {
    const currentUserCommunities = await prisma.userCommunity.findMany({
      where: {
        userId: userId,
        creator: {
          OR: [
            { name: { contains: query, mode: "insensitive" } },
            { email: { contains: query, mode: "insensitive" } },
          ],
        },
      },
      select: {
        creator: {
          select: {
            ...whitelistSelection,
            _count: {
              select: {
                communityMembers: true,
              },
            },
          },
        },
      },
    });
    return currentUserCommunities.map((community) => community.creator) || [];
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }
    return [];
  }
};

export const getAvailableUserCommunities = async ({
  userId,
  query,
}: {
  userId: string;
  query?: string;
}): Promise<TUserWhitelistInfo[]> => {
  try {
    const user = await prisma.user.findUnique({
      where: {
        id: userId,
      },
      select: {
        communities: {
          select: {
            creatorId: true,
          },
        },
      },
    });

    // Check if user exists
    if (!user) {
      throw new InvalidInputError("User does not exist!");
    }

    const currentUserCommunityCreatorIds = user.communities.map((community) => community.creatorId) || [];

    const availableUserCommunities = await prisma.user.findMany({
      where: {
        id: {
          notIn: currentUserCommunityCreatorIds,
        },
        whitelist: true,
        ...(query
          ? {
              OR: [
                {
                  name: {
                    contains: query,
                    mode: "insensitive",
                  },
                },
                {
                  email: {
                    contains: query,
                    mode: "insensitive",
                  },
                },
              ],
            }
          : {}),
      },
      select: {
        ...whitelistSelection,
        _count: {
          select: {
            communityMembers: true,
          },
        },
      },
    });

    const availableUserCommunitiesWithSurveysCount = await Promise.all(
      availableUserCommunities.map(async (community) => {
        const surveysCount = await prisma.survey.count({
          where: {
            createdBy: community.id,
          },
        });

        return {
          ...community,
          createdSurveys: surveysCount,
        };
      })
    );

    return availableUserCommunitiesWithSurveysCount;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }
    return [];
  }
};

export const updateUserCommunityFields = async ({
  userId,
  communityName,
  communityDescription,
}: {
  userId: string;
  communityName: string | undefined;
  communityDescription: string | undefined;
}): Promise<string> => {
  try {
    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(communityName ? { communityName: communityName } : {}),
        ...(communityDescription ? { communityDescription: communityDescription } : {}),
      },
    });

    return user.id;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }

    throw error;
  }
};

export const getCommunity = async ({ communityId }: { communityId: string }): Promise<TUserWhitelistInfo> => {
  try {
    const community = await prisma.user.findUnique({
      where: { id: communityId },
      select: whitelistSelection,
    });

    // Check if user exists
    if (!community) {
      throw new InvalidInputError("Community does not exist!");
    }

    const surveysCount = await prisma.survey.count({
      where: {
        createdBy: community.id,
      },
    });

    const communityMembers = await prisma.userCommunity.findMany({
      where: {
        creatorId: communityId,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            imageUrl: true,
            socials: {
              select: {
                id: true,
                provider: true,
                socialId: true,
                socialName: true,
                socialEmail: true,
                socialAvatar: true,
              },
            },
          },
        },
      },
    });

    return {
      ...community,
      createdSurveys: surveysCount,
      members: communityMembers.map((member) => member.user),
    };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }

    throw error;
  }
};
