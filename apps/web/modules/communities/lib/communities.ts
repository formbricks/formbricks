import { Prisma } from "@prisma/client";
import { prisma } from "@formbricks/database";
import { DatabaseError, InvalidInputError } from "@formbricks/types/errors";

// import { TUserCommunity } from "@formbricks/types/user";

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

// export const getUserCommunities = async ({
//   userId,
//   query,
// }: {
//   userId: string;
//   query?: string;
// }): Promise<TUserCommunity[]> => {
//   try {
//     const userCommunities = await prisma.userCommunity.findMany({
//     where: {
//         userId: userId,
//         creator: {
//             OR: [
//             { name: { contains: query, mode: 'insensitive' } },
//             { email: { contains: query, mode: 'insensitive' } },
//             ],
//         },
//         },
//       select: userCommunitySelection,
//     });
//     return userCommunities;
//   } catch (error) {
//     if (error instanceof Prisma.PrismaClientKnownRequestError) {
//       throw new DatabaseError(error.message);
//     }
//     return [];
//   }
// };
