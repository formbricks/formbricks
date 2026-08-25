import "server-only";
import { z } from "zod";
import { prisma } from "@formbricks/database";
import { Prisma } from "@formbricks/database/prisma";
import { DatabaseError } from "@formbricks/types/errors";
import { validateInputs } from "@/lib/utils/validate";

const handleDatabaseError = (error: unknown): never => {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    throw new DatabaseError(error.message);
  }

  throw error;
};

/**
 * Every UNEXPIRED session token belonging to a user, read from Postgres.
 *
 * Postgres is the authoritative enumeration source here, deliberately: `session.storeSessionInDatabase`
 * is on (auth.ts), so every session has a row, whereas Better Auth's own `internalAdapter.listSessions`
 * reads the `active-sessions-<userId>` index out of `secondaryStorage` and returns an empty list when
 * that key is missing or evicted — which would silently revoke nothing.
 */
export const getSessionTokensByUserId = async (userId: string): Promise<string[]> => {
  validateInputs([userId, z.string().min(1)]);

  try {
    const sessions = await prisma.session.findMany({
      where: {
        userId,
        // Expired rows are already unusable, and including them would inflate the revocation count that
        // lands in the SSO-recovery audit event — the one place that number is read as "how many
        // sessions the squatter was holding".
        expires: { gt: new Date() },
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
