import "server-only";
import { isValidImageFile } from "@/lib/fileValidation";
import { deleteOrganization, getOrganizationsWhereUserIsSingleOwner } from "@/lib/organization/service";
import { deleteBrevoCustomerByEmail } from "@/modules/auth/lib/brevo";
import { Prisma } from "@prisma/client";
import { cache as reactCache } from "react";
import { z } from "zod";
import { prisma } from "@formbricks/database";
import { PrismaErrorType } from "@formbricks/database/types/error";
import { ZId } from "@formbricks/types/common";
import { DatabaseError, InvalidInputError, ResourceNotFoundError } from "@formbricks/types/errors";
import { TUser, TUserLocale, TUserUpdateInput, ZUserUpdateInput } from "@formbricks/types/user";
import { validateInputs } from "../utils/validate";

const responseSelection = {
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
};

// function to retrive basic information about a user's user
export const getUser = reactCache(async (id: string): Promise<TUser | null> => {
  validateInputs([id, ZId]);

  try {
    const user = await prisma.user.findUnique({
      where: {
        id,
      },
      select: responseSelection,
    });

    if (!user) {
      return null;
    }
    return user;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }

    throw error;
  }
});

export const getUserByEmail = reactCache(async (email: string): Promise<TUser | null> => {
  validateInputs([email, z.string().email()]);

  try {
    const user = await prisma.user.findFirst({
      where: {
        email,
      },
      select: responseSelection,
    });

    return user;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }

    throw error;
  }
});

// function to update a user's user
export const updateUser = async (personId: string, data: TUserUpdateInput): Promise<TUser> => {
  validateInputs([personId, ZId], [data, ZUserUpdateInput.partial()]);
  if (data.imageUrl && !isValidImageFile(data.imageUrl)) throw new InvalidInputError("Invalid image file");

  try {
    const updatedUser = await prisma.user.update({
      where: {
        id: personId,
      },
      data: data,
      select: responseSelection,
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

const deleteUserById = async (id: string): Promise<TUser> => {
  validateInputs([id, ZId]);

  try {
    const user = await prisma.user.delete({
      where: {
        id,
      },
      select: responseSelection,
    });
    return user;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }

    throw error;
  }
};

// function to delete a user's user including organizations
export const deleteUser = async (id: string): Promise<TUser> => {
  validateInputs([id, ZId]);

  try {
    const organizationsWithSingleOwner = await getOrganizationsWhereUserIsSingleOwner(id);

    for (const organization of organizationsWithSingleOwner) {
      await deleteOrganization(organization.id);
    }

    const deletedUser = await deleteUserById(id);
    await deleteBrevoCustomerByEmail({ email: deletedUser.email });

    return deletedUser;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }

    throw error;
  }
};

export const getUsersWithOrganization = async (organizationId: string): Promise<TUser[]> => {
  validateInputs([organizationId, ZId]);

  try {
    const users = await prisma.user.findMany({
      where: {
        memberships: {
          some: {
            organizationId,
          },
        },
      },
      select: responseSelection,
    });

    return users;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }

    throw error;
  }
};

export const getUserLocale = reactCache(async (id: string): Promise<TUserLocale | undefined> => {
  validateInputs([id, ZId]);

  try {
    const user = await prisma.user.findUnique({
      where: {
        id,
      },
      select: responseSelection,
    });

    if (!user) {
      return undefined;
    }
    return user.locale;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }

    throw error;
  }
});
