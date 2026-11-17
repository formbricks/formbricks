import { prisma } from "@formbricks/database";
import type { Prisma } from "@formbricks/database/prisma";

/**
 * Waits until another session is blocked on the locks `tx` holds, so a race test can prove the competing
 * work actually reached the lock instead of relying on a sleep: `pg_blocking_pids` names, for a waiting
 * backend, the backends blocking it, so a row for `tx`'s pid means something is queued behind it.
 */
export const waitForBlockOn = async (tx: Prisma.TransactionClient, timeoutMs = 8_000): Promise<void> => {
  const [{ pid }] = await tx.$queryRaw<{ pid: number }[]>`SELECT pg_backend_pid() AS "pid"`;
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const [{ waiting }] = await prisma.$queryRaw<{ waiting: number }[]>`
      SELECT count(*)::int AS "waiting" FROM pg_stat_activity
      WHERE ${pid}::int = ANY(pg_blocking_pids("pid"))`;
    if (waiting > 0) return;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error("nothing blocked on the transaction's lock");
};

/**
 * Locks the user's row `FOR UPDATE` in `tx`, as a Revoke or a member removal holds it while it ends the
 * user's grants: what a code exchange's grant claim and a grant write wait on (`FOR KEY SHARE`).
 */
export const lockUserRow = async (tx: Prisma.TransactionClient, userId: string): Promise<void> => {
  await tx.$queryRaw`SELECT 1 FROM "User" WHERE "id" = ${userId} FOR UPDATE`;
};
