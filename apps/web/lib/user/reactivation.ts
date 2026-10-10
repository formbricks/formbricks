import "server-only";
import type { Prisma } from "@formbricks/database/prisma";
import { readDatabaseClock } from "@/lib/utils/database-clock";

/**
 * Lock the user row `FOR UPDATE` and say whether the account is active, or null when there is no such
 * user. Taken before reactivating, so the false→true change is seen by exactly one writer, and ordered
 * against a deactivation (the data retention sweep locks the same row) and against a membership being
 * added meanwhile (its foreign key takes `FOR KEY SHARE` on this row, so it waits).
 */
export const lockUserActiveState = async (
  tx: Prisma.TransactionClient,
  userId: string
): Promise<{ isActive: boolean } | null> => {
  const [user] = await tx.$queryRaw<{ isActive: boolean }[]>`
    SELECT "isActive" FROM "User" WHERE "id" = ${userId} FOR UPDATE
  `;
  return user ?? null;
};

/**
 * Reactivate an account whose row the caller locked (`lockUserActiveState`) and found inactive, in the
 * caller's transaction. Every path that turns an account back on goes through here, so none can leave
 * it to be deactivated again with no warning:
 * - `reactivatedAt` restarts the data retention members clock (on the database clock, like the times it
 *   is compared with), without touching `lastLoginAt`, which reports real sign-ins;
 * - the user's members notices are deleted, so a later lapse gets a new notice and a full warning.
 * The `isActive` change reaches SpiceDB through the projection outbox trigger on the column. Returns
 * the stored `reactivatedAt`.
 */
export const reactivateLockedUser = async (tx: Prisma.TransactionClient, userId: string): Promise<Date> => {
  const now = await readDatabaseClock(tx);
  const { reactivatedAt } = await tx.user.update({
    where: { id: userId },
    data: { isActive: true, reactivatedAt: now },
    select: { reactivatedAt: true },
  });
  await tx.retentionNotice.deleteMany({ where: { userId, entity: "members" } });
  return reactivatedAt ?? now;
};
