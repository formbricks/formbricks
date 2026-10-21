import { setTimeout as delay } from "node:timers/promises";
import { prisma } from "@formbricks/database";

const POLL_INTERVAL_MS = 50;
const TIMEOUT_MS = 20_000;

/**
 * Fixtures seed users, organizations, memberships, workspaces and surveys straight through Prisma. The
 * database triggers still enqueue their AuthZed projection, but SpiceDB only sees it once the outbox
 * worker delivers it. A page loaded before then finds no organization for the user and redirects to
 * `/setup/organization/create` (ENG-4101).
 *
 * Waits until every outbox row enqueued so far has been delivered. Rows enqueued later by other
 * workers do not extend the wait, and dead letters are skipped because they will never be delivered.
 */
export const waitForAuthzedProjection = async (): Promise<void> => {
  // The column default is the database's local CURRENT_TIMESTAMP, so take the cutoff from the same clock.
  const [{ cutoff }] = await prisma.$queryRaw<{ cutoff: Date }[]>`SELECT LOCALTIMESTAMP(3) AS cutoff`;
  const deadline = Date.now() + TIMEOUT_MS;

  for (;;) {
    const pending = await prisma.authzedProjectionOutbox.count({
      where: { processedAt: null, deadLetteredAt: null, createdAt: { lte: cutoff } },
    });
    if (pending === 0) return;
    if (Date.now() >= deadline) {
      throw new Error(
        `${pending} AuthZed projection outbox rows are still undelivered after ${TIMEOUT_MS / 1000}s. ` +
          "Is the outbox worker running? CI starts scripts/authzed-ci-outbox-worker.ts (see ENG-2958)."
      );
    }
    await delay(POLL_INTERVAL_MS);
  }
};
