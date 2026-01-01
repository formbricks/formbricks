"use server";

import { getServerSession } from "next-auth";
import { getToken } from "next-auth/jwt";
import { cookies } from "next/headers";
import { prisma } from "@formbricks/database";
import { logger } from "@formbricks/logger";
import { NEXTAUTH_SECRET } from "@/lib/constants";
import { authOptions } from "@/modules/auth/lib/authOptions";

/**
 * Invalidates the current user's session by deleting it from the database.
 * This is called during logout to ensure JWT tokens cannot be reused.
 */
export async function invalidateCurrentSession() {
  try {
    const cookieStore = await cookies();
    const cookieHeader = cookieStore
      .getAll()
      .map((c) => `${c.name}=${c.value}`)
      .join("; ");

    const token = await getToken({
      req: { headers: { cookie: cookieHeader } } as any,
      secret: NEXTAUTH_SECRET,
    });

    const sessionToken = (token as any)?.sessionToken as string | undefined;
    if (sessionToken) {
      await prisma.session.deleteMany({ where: { sessionToken } });
      logger.info({ sessionToken }, "Invalidated current session by sessionToken");
      return;
    }

    // Fallback: if we can't decode the token, invalidate all sessions for the current user.
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      logger.warn("No active session to invalidate");
      return;
    }

    const result = await prisma.session.deleteMany({ where: { userId: session.user.id } });
    logger.info({ userId: session.user.id, sessionsDeleted: result.count }, "Invalidated all user sessions");
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
      },
      "Failed to invalidate current session"
    );
    // Don't throw - we don't want to block logout if session deletion fails
  }
}

/**
 * Invalidates all sessions for a given user.
 * Useful for "logout from all devices" functionality.
 *
 * @param userId - The ID of the user whose sessions should be invalidated
 * @throws Error if the operation fails
 */
export async function invalidateAllUserSessions(userId: string) {
  try {
    const result = await prisma.session.deleteMany({
      where: { userId },
    });

    logger.info(
      {
        userId,
        sessionsDeleted: result.count,
      },
      "Invalidated all user sessions"
    );

    return result.count;
  } catch (error) {
    logger.error(
      {
        userId,
        error: error instanceof Error ? error.message : String(error),
      },
      "Failed to invalidate user sessions"
    );
    throw error;
  }
}
