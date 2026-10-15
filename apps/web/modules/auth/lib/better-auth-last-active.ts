import "server-only";
import type { BetterAuthOptions, BetterAuthPlugin } from "better-auth";
import { createAuthMiddleware } from "better-auth/api";
import { prisma } from "@formbricks/database";
import { logger } from "@formbricks/logger";
import { readDatabaseClock } from "@/lib/utils/database-clock";

type SessionDatabaseHook = NonNullable<NonNullable<BetterAuthOptions["databaseHooks"]>["session"]>;
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
    logger
      .withContext({ source: "better-auth" })
      .error({ err: error, userId }, "Failed to record user activity");
  }
};

/**
 * A completed sign-in, of any kind, is activity: the session the request ends with
 * (`ctx.context.newSession`), read once every hook before this one has run.
 *
 * Not `databaseHooks.session.create`: for a user with two-factor authentication, a correct password
 * alone creates a session, which the two-factor plugin's after hook then deletes (setting `newSession`
 * back to null) until the second factor is verified. Counting that session would let a password alone
 * keep a dormant 2FA account active under the members policy. Better Auth runs `hooks.after` first and
 * the plugins' after hooks in list order, so this must be a plugin listed after `twoFactor()`.
 */
export const recordActivityOnSignIn = createAuthMiddleware(async (ctx) => {
  await recordCompletedSignIn(ctx.context.newSession);
});

/** The session a request ended with, if any: its user was active. None (a 2FA challenge) is nothing. */
export const recordCompletedSignIn = async (newSession: { user: { id: string } } | null): Promise<void> => {
  if (newSession) await recordUserActivity(newSession.user.id);
};

/** `recordActivityOnSignIn` as a plugin, for auth.ts's plugin list, after `twoFactor()`. */
export const lastActivePlugin = {
  id: "formbricks-last-active",
  hooks: { after: [{ matcher: () => true, handler: recordActivityOnSignIn }] },
} satisfies BetterAuthPlugin;

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
