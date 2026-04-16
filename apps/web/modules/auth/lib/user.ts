import { Prisma, PrismaClient } from "@prisma/client";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { PrismaErrorType } from "@formbricks/database/types/error";
import { ZId } from "@formbricks/types/common";
import { DatabaseError, InvalidInputError, ResourceNotFoundError } from "@formbricks/types/errors";
import { TUserCreateInput, TUserUpdateInput, ZUserEmail, ZUserUpdateInput } from "@formbricks/types/user";
import { validateInputs } from "@/lib/utils/validate";

type TUserDbClient = PrismaClient | Prisma.TransactionClient;

const getDbClient = (tx?: Prisma.TransactionClient): TUserDbClient => tx ?? prisma;

export const updateUser = async (id: string, data: TUserUpdateInput, tx?: Prisma.TransactionClient) => {
  validateInputs([id, ZId], [data, ZUserUpdateInput.partial()]);

  try {
    const updatedUser = await getDbClient(tx).user.update({
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
    return await prisma.$transaction(async (tx) => {
      const lockedUsers = await tx.$queryRaw<Array<{ id: string; lastLoginAt: Date | null }>>`
        SELECT "id", "lastLoginAt"
        FROM "User"
        WHERE "email" = ${email}
        FOR UPDATE
      `;
      const lockedUser = lockedUsers[0];

      if (!lockedUser) {
        throw new ResourceNotFoundError("email", email);
      }

      await tx.user.update({
        where: {
          id: lockedUser.id,
        },
        data: {
          lastLoginAt: new Date(),
        },
      });

      return lockedUser.lastLoginAt;
    });
  } catch (error) {
    if (error instanceof ResourceNotFoundError) {
      throw error;
    }

    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === PrismaErrorType.RecordDoesNotExist
    ) {
      throw new ResourceNotFoundError("email", email);
    }
    throw error;
  }
};

export const getUserByEmail = reactCache(async (email: string) => {
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
        identityProvider: true,
      },
    });

    return user;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }

    throw error;
  }
});

export const getUser = reactCache(async (id: string) => {
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
});

export const createUser = async (data: TUserCreateInput, tx?: Prisma.TransactionClient) => {
  validateInputs([data, ZUserUpdateInput]);
  try {
    const user = await getDbClient(tx).user.create({
      data: data,
      select: {
        name: true,
        notificationSettings: true,
        id: true,
        email: true,
        locale: true,
      },
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
