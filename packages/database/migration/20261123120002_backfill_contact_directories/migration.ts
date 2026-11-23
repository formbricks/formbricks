import { logger } from "@formbricks/logger";
import type { PrismaClient } from "../../src/prisma";
import type { AutocommitDataMigrationScript } from "../../src/scripts/migration-runner";

const BATCH_SIZE = 10_000;
// The workspaces with the most contacts go last: on Cloud three of them hold two thirds of all contacts.
const LARGEST_LAST = 3;
const DEADLOCK_RETRIES = 3;
const PROGRESS_EVERY_BATCHES = 100;
// The report names the directories with the most contacts and sums up the rest.
const REPORTED_DIRECTORIES = 20;

const isDeadlock = (error: unknown): boolean => {
  const err = error as {
    code?: unknown;
    meta?: { driverAdapterError?: { cause?: { originalCode?: unknown } } };
    message?: unknown;
  };
  return (
    err.code === "40P01" ||
    err.meta?.driverAdapterError?.cause?.originalCode === "40P01" ||
    (typeof err.message === "string" && err.message.includes("deadlock detected"))
  );
};

/**
 * One batch: the next BATCH_SIZE contacts by id after `afterId`. Locks, in id order, those that still have
 * no directory and whose workspace has one (the lock re-checks `directoryId IS NULL` on the current row,
 * so a directory written meanwhile is kept), skips the workspaces in `exclude`, and writes the workspace's
 * directory. Commits on its own.
 */
const backfillBatch = async (prisma: PrismaClient, afterId: string, exclude: string[]) => {
  for (let attempt = 1; ; attempt++) {
    try {
      const [batch] = await prisma.$queryRaw<{ lastId: string | null; scanned: number; written: number }[]>`
        WITH page AS (
          SELECT c."id" FROM "Contact" c WHERE c."id" > ${afterId} ORDER BY c."id" LIMIT ${BATCH_SIZE}
        ),
        locked AS (
          SELECT c."id", w."contactDirectoryId" AS "directoryId"
          FROM "Contact" c
          JOIN page ON page."id" = c."id"
          JOIN "Workspace" w ON w."id" = c."workspaceId"
          WHERE c."directoryId" IS NULL
            AND w."contactDirectoryId" IS NOT NULL
            AND c."workspaceId" <> ALL(${exclude}::TEXT[])
          ORDER BY c."id"
          FOR UPDATE OF c
        ),
        written AS (
          UPDATE "Contact" c SET "directoryId" = locked."directoryId"
          FROM locked WHERE c."id" = locked."id"
          RETURNING c."id"
        )
        SELECT (SELECT MAX("id") FROM page) AS "lastId",
               (SELECT count(*)::int FROM page) AS "scanned",
               (SELECT count(*)::int FROM written) AS "written"
      `;
      return batch;
    } catch (error) {
      // A writer of the previous release can lock two of this batch's contacts in the other order.
      if (!isDeadlock(error) || attempt >= DEADLOCK_RETRIES) throw error;
      logger.warn({ afterId, attempt }, "Contact directory backfill: batch deadlocked, retrying");
    }
  }
};

/** Walks every contact by id once, in batches. Returns how many contacts got a directory. */
const walkContacts = async (
  prisma: PrismaClient,
  signal: AbortSignal,
  pass: "smaller workspaces" | "remaining contacts",
  exclude: string[]
): Promise<number> => {
  let afterId = "";
  let written = 0;
  for (let batches = 1; ; batches++) {
    signal.throwIfAborted();
    const batch = await backfillBatch(prisma, afterId, exclude);
    written += batch.written;
    if (batches % PROGRESS_EVERY_BATCHES === 0) {
      logger.info({ pass, batches, written, lastId: batch.lastId }, "Contact directory backfill: progress");
    }
    if (batch.lastId === null || batch.scanned < BATCH_SIZE) return written;
    afterId = batch.lastId;
  }
};

/**
 * ENG-7491: sets `Contact.directoryId` to the directory of the contact's workspace, made by the previous
 * migration. About 37M contacts on Cloud, so it runs outside the runner's transaction, in batches of 10,000
 * by id that commit on their own and hold their row locks only for the batch.
 *
 * Two passes over the table: the first skips the three workspaces with the most contacts, so every smaller
 * workspace is done first; the second does everything left, which is those three plus any contact a
 * writer of the previous release added behind the first pass. Rows only change from no directory to their
 * workspace's directory, so a rerun, or a run resumed after a crash, carries on with what is left, and a
 * batch that overlaps a killed run's last one writes nothing twice.
 *
 * Then a sweep of the attribute keys and segments that a writer of the previous release added while the
 * previous migration ran, before its directories were committed, and a counts-only report.
 */
export const backfillContactDirectories: AutocommitDataMigrationScript = {
  type: "data",
  id: "uazp19qjacl2twn8k00r39rm",
  name: "20261123120002_backfill_contact_directories",
  transactional: false,
  run: async ({ prisma, signal }) => {
    const pending = await prisma.$queryRaw<{ workspaceId: string | null; contacts: number }[]>`
      SELECT "workspaceId", count(*)::int AS "contacts" FROM "Contact"
      WHERE "directoryId" IS NULL
      GROUP BY "workspaceId"
      ORDER BY count(*) DESC, "workspaceId"
    `;
    const contactsToBackfill = pending.reduce((sum, row) => sum + row.contacts, 0);
    const largest = pending
      .flatMap(({ workspaceId }) => (workspaceId === null ? [] : [workspaceId]))
      .slice(0, LARGEST_LAST);
    logger.info(
      { contactsToBackfill, workspaces: pending.length, largestLast: largest.length },
      "Contact directory backfill: starting"
    );

    if (contactsToBackfill > 0) {
      const smaller = await walkContacts(prisma, signal, "smaller workspaces", largest);
      const remaining = await walkContacts(prisma, signal, "remaining contacts", []);
      logger.info({ written: smaller + remaining }, "Contact directory backfill: contacts done");
    }

    signal.throwIfAborted();
    const attributeKeysSwept = await prisma.$executeRaw`
      UPDATE "ContactAttributeKey" k SET "directoryId" = w."contactDirectoryId"
      FROM "Workspace" w
      WHERE w."id" = k."workspaceId" AND k."directoryId" IS NULL AND w."contactDirectoryId" IS NOT NULL
    `;
    const segmentsSwept = await prisma.$executeRaw`
      UPDATE "Segment" s SET "directoryId" = w."contactDirectoryId"
      FROM "Workspace" w
      WHERE w."id" = s."workspaceId" AND s."directoryId" IS NULL AND w."contactDirectoryId" IS NOT NULL
    `;

    const perDirectory = await prisma.$queryRaw<{ directoryId: string | null; contacts: number }[]>`
      SELECT "directoryId", count(*)::int AS "contacts" FROM "Contact"
      GROUP BY "directoryId"
      ORDER BY count(*) DESC, "directoryId"
    `;
    const withDirectory = perDirectory.filter(
      (row): row is { directoryId: string; contacts: number } => row.directoryId !== null
    );
    const reported = withDirectory.slice(0, REPORTED_DIRECTORIES);
    const others = withDirectory.slice(REPORTED_DIRECTORIES);
    logger.info(
      {
        directoriesWithContacts: withDirectory.length,
        contactsPerDirectory: Object.fromEntries(reported.map((row) => [row.directoryId, row.contacts])),
        otherDirectories: others.length,
        otherDirectoriesContacts: others.reduce((sum, row) => sum + row.contacts, 0),
        // Left only for a workspace with no directory: one a previous-release pod created mid-rollout.
        contactsWithoutDirectory: perDirectory.find((row) => row.directoryId === null)?.contacts ?? 0,
        attributeKeysSwept,
        segmentsSwept,
      },
      "Contact directory backfill: report"
    );
  },
};
