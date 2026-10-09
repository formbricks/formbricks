import "server-only";
import type { BetterAuthOptions } from "better-auth";
import { prisma } from "@formbricks/database";
import { logger } from "@formbricks/logger";
import { readDatabaseClock } from "@/lib/utils/database-clock";

type SessionDatabaseHook = NonNullable<NonNullable<BetterAuthOptions["databaseHooks"]>["session"]>;
type SessionCreateAfter = NonNullable<NonNullable<SessionDatabaseHook["create"]>["after"]>;
type SessionUpdateAfter = NonNullable<NonNullable<SessionDatabaseHook["update"]>["after"]>;

/**
 * Record that the user was active now: `User.lastActiveAt`, moved forward only (`GREATEST`, which
 * skips the NULL of someone never recorded), on the database clock like the retention times it is
 * compared with. The members retention clock reads it (`getMemberRetentionClock`). A `Session` row
 * can't serve as that record: Better Auth deletes it on sign-out and on expiry, and with it the only
 * trace of the activity, which would revive a notice the activity had voided.
 *
 * Never throws: a failure here must not break a sign-in or a session renewal, so it is logged instead.
 * The cost of a lost write is a member counted from their previous activity, warned before anything
 * happens to them.
 */
export const recordUserActivity = async (userId: string): Promise<void> => {
  try {
    const now = await readDatabaseClock(prisma);
    await prisma.$executeRaw`
      UPDATE "User" SET "lastActiveAt" = GREATEST("lastActiveAt", ${now}) WHERE "id" = ${userId}
    `;
  } catch (error) {
    logger.withContext({ source: "better-auth" }).error({ error, userId }, "Failed to record user activity");
  }
};

/**
 * `databaseHooks.session.create.after`: every new session (a sign-in of any kind) is activity. Composed
 * in auth.ts with the sign-in audit, which runs on the same slot.
 */
export const recordActivityOnSessionCreate: SessionCreateAfter = async (session) => {
  await recordUserActivity(session.userId);
};

/**
 * `databaseHooks.session.update.after`: a session renewal (`updateSession`, which Better Auth runs
 * through its update hooks once the session is `updateAge` old and in use) is activity too, so someone
 * who stays signed in counts as active. Better Auth hands over the updated row, or null when it was
 * deleted meanwhile; with no row there is nothing to record.
 */
export const recordActivityOnSessionUpdate: SessionUpdateAfter = async (session) => {
  const userId = (session as { userId?: unknown } | null)?.userId;
  if (typeof userId === "string") await recordUserActivity(userId);
};
