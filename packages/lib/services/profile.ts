import { prisma } from "@formbricks/database";
import { DatabaseError, ResourceNotFoundError } from "@formbricks/errors";
import { Prisma } from "@prisma/client";
import { TProfile, TProfileUpdateOutput } from "@formbricks/types/v1/profile";
import { cache } from "react";

const responseSelection = {
  id: true,
  name: true,
  email: true

}

// function to retrive basic information about a user's profile 
export const getProfile = cache(async (userId: string): Promise<TProfile> => {
  try {
    const profile = await prisma.user.findUnique({
      where: {
        id: userId,
      },
      select: responseSelection
    });

    if (!profile) {
      throw new ResourceNotFoundError("Profile", userId);
    }

    return profile;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError("Database operation failed");
    }

    throw error;
  }
});

// function to update a user's profile 
export const updateProfile = async (
  userId: string,
  data: Prisma.UserUpdateInput
): Promise<TProfileUpdateOutput> => {
  try {
    const currentProfile = await getProfile(userId);

    if (!currentProfile) {
      throw new ResourceNotFoundError("Profile", userId);
    }

    const updatedProfile = await prisma.user.update({
      where: {
        id: userId,
      },
      data: data
    });

    return updatedProfile;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError("Database operation failed");
    }

    throw error;
  }
};

// function to delete a user's profile 
export const deleteProfile = async (userId: string): Promise<void> => {
  try {
    await prisma.user.delete({
      where: {
        id: userId,
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError("Database operation failed");
    }

    throw error;
  }
};
