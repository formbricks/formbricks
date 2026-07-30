import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { Prisma, PrismaClient } from "@formbricks/database/prisma";
import { PrismaErrorType } from "@formbricks/database/types/error";
import { ZId } from "@formbricks/types/common";
import { DatabaseError, InvalidInputError, ResourceNotFoundError } from "@formbricks/types/errors";
import { TUserCreateInput, TUserUpdateInput, ZUserEmail, ZUserUpdateInput } from "@formbricks/types/user";
import { isPrismaKnownRequestError, isUniqueConstraintError } from "@/lib/utils/prisma-error";
import { validateInputs } from "@/lib/utils/validate";

type TUserDbClient = PrismaClient | Prisma.TransactionClient;

const getDbClient = (tx?: Prisma.TransactionClient): TUserDbClient => tx ?? prisma;

// A Postgres deadlock aborts ONE transaction in the cycle (SQLSTATE 40P01) and is safe to retry.
// Prisma reports it as P2034 on interactive transactions; the pg driver adapter can also surface it as
// a DriverAdapterError whose message carries "deadlock detected" (the shape seen in Sentry for ENG-2038).
const isDeadlockError = (error: unknown): boolean => {
  if (isPrismaKnownRequestError(error) && error.code === "P2034") {
    return true;
  }
  const message = error instanceof Error ? error.message : "";
  return /deadlock detected/i.test(message) || message.includes("40P01");
};

const DEADLOCK_MAX_ATTEMPTS = 3;

/**
 * Retry a DB operation a bounded number of times when it fails with a deadlock, with a short linear
 * backoff so retried transactions don't re-collide in lockstep. Non-deadlock errors propagate on the
 * first attempt. Defense-in-depth for the login write path (ENG-2038); the caller must be idempotent.
 */
const retryOnDeadlock = async <T>(operation: () => Promise<T>): Promise<T> => {
  for (let attempt = 1; ; attempt++) {
    try {
      return await operation();
    } catch (error) {
      if (attempt >= DEADLOCK_MAX_ATTEMPTS || !isDeadlockError(error)) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, attempt * 25));
    }
  }
};

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
    if (isPrismaKnownRequestError(error, PrismaErrorType.RecordNotFound)) {
      throw new ResourceNotFoundError("User", id);
    }
    throw error;
  }
};

export const updateUserLastLoginAt = async (email: string) => {
  validateInputs([email, ZUserEmail]);

  try {
    // Retry on a transient deadlock (40P01): the last-login bump is idempotent, so a bounded retry
    // clears rare cross-transaction contention on the hot login path instead of surfacing a 500.
    return await retryOnDeadlock(() =>
      prisma.$transaction(async (tx) => {
        // FOR NO KEY UPDATE (not FOR UPDATE): this serializes concurrent same-user updates of
        // lastLoginAt, but — unlike FOR UPDATE — does NOT conflict with the FOR KEY SHARE lock that a
        // concurrent Session→User FK insert takes on this row during sign-in. FOR UPDATE here was
        // stronger than the subsequent UPDATE needs and created a deadlock cycle on the login path
        // (ENG-2038). The row is only read to return the previous lastLoginAt for a login analytics flag.
        const lockedUsers = await tx.$queryRaw<Array<{ id: string; lastLoginAt: Date | null }>>`
        SELECT "id", "lastLoginAt"
        FROM "User"
        WHERE "email" = ${email}
        FOR NO KEY UPDATE
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
      })
    );
  } catch (error) {
    if (error instanceof ResourceNotFoundError) {
      throw error;
    }

    if (isPrismaKnownRequestError(error, PrismaErrorType.RecordNotFound)) {
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
    if (isPrismaKnownRequestError(error)) {
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
    if (isPrismaKnownRequestError(error)) {
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
    if (isUniqueConstraintError(error)) {
      throw new InvalidInputError("User with this email already exists");
    }

    if (isPrismaKnownRequestError(error)) {
      throw new DatabaseError(error.message);
    }

    throw error;
  }
};
