import { isValidImageFile } from "@/lib/fileValidation";
import { Prisma } from "@prisma/client";
import { prisma } from "@formbricks/database";
import { PrismaErrorType } from "@formbricks/database/types/error";
import { InvalidInputError, ResourceNotFoundError } from "@formbricks/types/errors";
import { TUser, TUserUpdateInput } from "@formbricks/types/user";

// function to update a user's user
export const updateUser = async (personId: string, data: TUserUpdateInput): Promise<TUser> => {
  if (data.imageUrl && !isValidImageFile(data.imageUrl)) throw new InvalidInputError("Invalid image file");

  try {
    const updatedUser = await prisma.user.update({
      where: {
        id: personId,
      },
      data: data,
      select: {
        id: true,
        name: true,
        email: true,
        emailVerified: true,
        imageUrl: true,
        createdAt: true,
        updatedAt: true,
        role: true,
        twoFactorEnabled: true,
        identityProvider: true,
        objective: true,
        notificationSettings: true,
        locale: true,
        lastLoginAt: true,
        isActive: true,
      },
    });

    return updatedUser;
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === PrismaErrorType.RecordDoesNotExist
    ) {
      throw new ResourceNotFoundError("User", personId);
    }
    throw error; // Re-throw any other errors
  }
};
