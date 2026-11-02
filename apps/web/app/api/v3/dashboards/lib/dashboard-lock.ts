import "server-only";
import type { Prisma } from "@formbricks/database/prisma";

/** A dashboard row held by `lockDashboard`, with the `updatedAt` it had when locked. */
export type TLockedDashboard = { updatedAt: Date };

/**
 * Lock a dashboard's row until the transaction ends. Every write to the dashboard takes this lock first,
 * and under read committed each later statement sees what the previous lock holder committed. `null` when
 * the dashboard no longer exists.
 */
export const lockDashboard = async (
  tx: Prisma.TransactionClient,
  dashboardId: string
): Promise<TLockedDashboard | null> => {
  const [row] = await tx.$queryRaw<TLockedDashboard[]>`
    SELECT "updated_at" AS "updatedAt" FROM "Dashboard" WHERE id = ${dashboardId} FOR UPDATE`;
  return row ?? null;
};

/**
 * The `updatedAt` a write gives the dashboard it holds locked: now, but always at least a millisecond
 * past the previous one. `updatedAt` is the token a whole-dashboard save is checked against, so every
 * write must change it: with a millisecond clock, two writes in the same millisecond (or a pod whose
 * clock lags) would otherwise leave it as it was, and an editor holding the first could save over the
 * second unwarned.
 */
export const nextDashboardUpdatedAt = (locked: TLockedDashboard, now: Date = new Date()): Date =>
  new Date(Math.max(now.getTime(), locked.updatedAt.getTime() + 1));
