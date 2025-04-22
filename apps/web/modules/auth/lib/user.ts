import { cache } from "@/lib/cache";
import { userCache } from "@/lib/user/cache";
import { validateInputs } from "@/lib/utils/validate";
import { Prisma } from "@prisma/client";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { PrismaErrorType } from "@formbricks/database/types/error";
import { ZId } from "@formbricks/types/common";
import { DatabaseError, InvalidInputError, ResourceNotFoundError } from "@formbricks/types/errors";
import { TUserCreateInput, TUserUpdateInput, ZUserEmail, ZUserUpdateInput } from "@formbricks/types/user";

export const updateUser = async (id: string, data: TUserUpdateInput) => {
  validateInputs([id, ZId], [data, ZUserUpdateInput.partial()]);

  try {
    const updatedUser = await prisma.user.update({
      where: {
        id,
      },
      data: data,
      select: {
        id: true,
        email: true,
        locale: true,
        emailVerified: true,
      },
    });

    userCache.revalidate({
      email: updatedUser.email,
      id: updatedUser.id,
    });

    return updatedUser;
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === PrismaErrorType.RecordDoesNotExist
    ) {
      throw new ResourceNotFoundError("User", id);
    }
    throw error;
  }
};

export const updateUserLastLoginAt = async (email: string) => {
  validateInputs([email, ZUserEmail]);

  try {
    const updatedUser = await prisma.user.update({
      where: {
        email,
      },
      data: {
        lastLoginAt: new Date(),
      },
    });

    userCache.revalidate({
      email: updatedUser.email,
      id: updatedUser.id,
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === PrismaErrorType.RecordDoesNotExist
    ) {
      throw new ResourceNotFoundError("email", email);
    }
    throw error;
  }
};

export const getUserByEmail = reactCache(async (email: string) =>
  cache(
    async () => {
      validateInputs([email, ZUserEmail]);

      try {
        const user = await prisma.user.findFirst({
          where: {
            email,
          },
          select: {
            id: true,
            locale: true,
            email: true,
            emailVerified: true,
            isActive: true,
          },
        });

        return user;
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError) {
          throw new DatabaseError(error.message);
        }

        throw error;
      }
    },
    [`getUserByEmail-${email}`],
    {
      tags: [userCache.tag.byEmail(email)],
    }
  )()
);

export const getUser = reactCache(async (id: string) =>
  cache(
    async () => {
      validateInputs([id, ZId]);

      try {
        const user = await prisma.user.findUnique({
          where: {
            id,
          },
          select: {
            id: true,
          },
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
    },
    [`getUser-${id}`],
    {
      tags: [userCache.tag.byId(id)],
    }
  )()
);

export const createUser = async (data: TUserCreateInput) => {
  validateInputs([data, ZUserUpdateInput]);
  try {
    const user = await prisma.user.create({
      data: data,
      select: {
        name: true,
        notificationSettings: true,
        id: true,
        email: true,
        locale: true,
      },
    });

    userCache.revalidate({
      email: user.email,
      id: user.id,
      count: true,
    });

    return user;
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === PrismaErrorType.UniqueConstraintViolation
    ) {
      throw new InvalidInputError("User with this email already exists");
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }

    throw error;
  }
};
