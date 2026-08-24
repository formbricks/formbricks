import "server-only";
import { z } from "zod";
import { prisma } from "@formbricks/database";
import { Prisma, PrismaClient } from "@formbricks/database/prisma";
import { DatabaseError } from "@formbricks/types/errors";
import { validateInputs } from "@/lib/utils/validate";

type TAuthSessionDbClient = PrismaClient | Prisma.TransactionClient;

const getDbClient = (tx?: Prisma.TransactionClient): TAuthSessionDbClient => tx ?? prisma;

const handleDatabaseError = (error: unknown): never => {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    throw new DatabaseError(error.message);
  }

  throw error;
};

/**
 * Every session token belonging to a user, read from Postgres.
 *
 * Postgres is the authoritative enumeration source here, deliberately: `session.storeSessionInDatabase`
 * is on (auth.ts), so every session has a row, whereas Better Auth's own `internalAdapter.listSessions`
 * reads the `active-sessions-<userId>` index out of `secondaryStorage` and returns an empty list when
 * that key is missing or evicted — which would silently revoke nothing.
 */
export const getSessionTokensByUserId = async (
  userId: string,
  tx?: Prisma.TransactionClient
): Promise<string[]> => {
  validateInputs([userId, z.string().min(1)]);

  try {
    const sessions = await getDbClient(tx).session.findMany({
      where: {
        userId,
      },
      select: {
        sessionToken: true,
      },
    });

    return sessions.map((session) => session.sessionToken);
  } catch (error) {
    return handleDatabaseError(error);
  }
};
