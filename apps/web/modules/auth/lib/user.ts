import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { Prisma, PrismaClient } from "@formbricks/database/prisma";
import { PrismaErrorType } from "@formbricks/database/types/error";
import { ZId } from "@formbricks/types/common";
import { DatabaseError, InvalidInputError, ResourceNotFoundError } from "@formbricks/types/errors";
import { TUserCreateInput, TUserUpdateInput, ZUserEmail, ZUserUpdateInput } from "@formbricks/types/user";
import { normalizeEmailForComparison } from "@/lib/utils/email";
import { retryOnDeadlock } from "@/lib/utils/prisma-deadlock";
import { isPrismaKnownRequestError, isUniqueConstraintError } from "@/lib/utils/prisma-error";
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
    // No identifier in the log context: the only one in scope here is the email.
    return await retryOnDeadlock(
      () =>
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
        }),
      { operation: "updateUserLastLoginAt" }
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

/**
 * Look a user up by email address.
 *
 * The address is canonicalized before the query rather than at each call site. Postgres compares
 * `text` case-sensitively, so a raw `findFirst` on `email` disagrees with Better Auth, which stores
 * and looks up `email.toLowerCase()` — and Better Auth is who we hand the result to. That
 * disagreement is the whole defect: `forgotPasswordAction` passed the form input through unchanged,
 * so `Alice@example.com` matched no row, the action took its enumeration-safe silent-skip branch, and
 * the user was told to check an inbox nothing had been sent to (ENG-3257).
 *
 * Normalizing here, not in the callers, is deliberate. ENG-1548 was the same defect and was fixed by
 * lowercasing at the call sites it knew about; this call site was not one of them, and nothing made
 * that visible. Inside the query, every present and future caller is correct by construction.
 *
 * This is exact parity with Better Auth, NOT a case-insensitive match. `mode: "insensitive"` would be
 * strictly worse here: it would find a user whose STORED address contains capitals, then hand that
 * address back to Better Auth, which lowercases it and finds nobody — mailing nothing while the audit
 * trail records a password reset that happened. Those accounts need the stored addresses normalized
 * (deferred; it must reconcile case-variant duplicates first), not a lookup that hides them.
 */
export const getUserByEmail = reactCache(async (email: string) => {
  validateInputs([email, ZUserEmail]);

  try {
    const user = await prisma.user.findFirst({
      where: {
        email: normalizeEmailForComparison(email),
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
