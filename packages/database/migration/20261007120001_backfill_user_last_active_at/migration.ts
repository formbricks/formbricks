import { logger } from "@formbricks/logger";
import type { MigrationScript } from "../../src/scripts/migration-runner";

const BATCH_SIZE = 5000;

/**
 * ENG-3612: seed `User.lastActiveAt` (added by the schema migration before this one), once, with the
 * latest of the user's last sign-in (`lastLoginAt`) and their live sessions. The members retention clock
 * reads `lastActiveAt` alone from now on (`lastLoginAt` is also written when a password is accepted but
 * a second factor never is), so the sign-ins recorded before it existed have to be carried over; and
 * someone who has stayed signed in since their last sign-in isn't counted from that sign-in on the
 * members policy's first night.
 *
 * Better Auth deletes a session on sign-out but an expired one only lazily, hence the `expires` filter.
 * `expires` is a UTC `timestamp`, so it is compared with UTC wall-clock time whatever the session time
 * zone. A user takes the newest of `lastLoginAt` and the `updated_at` of their live sessions.
 *
 * Batches go through the autocommit `prisma` handle rather than the runner's transaction, so each commits
 * on its own and "User" is never locked for the whole pass: sign-ins and session checks keep going. The
 * pass walks every user once, by id (a keyset, so the users with nothing to seed, who are never written,
 * aren't scanned again by every batch), seeding those that still have no `lastActiveAt` and do have a
 * sign-in or a live session. A rerun walks again and finds nothing left to seed; an empty database is a
 * no-op.
 *
 * The session hooks write `lastActiveAt` meanwhile (`recordUserActivity`: `GREATEST`, forward only). The
 * `"lastActiveAt" IS NULL` is re-checked on the row as it is locked, so a value a hook wrote first is
 * kept, and a hook writing after takes the later of the two.
 */
export const backfillUserLastActiveAt: MigrationScript = {
  type: "data",
  id: "fz8qkpnf0unlhlukw1hnjv7e",
  name: "20261007120001_backfill_user_last_active_at",
  run: async ({ prisma }) => {
    let afterId = "";
    let seeded = 0;
    for (;;) {
      const [batch] = await prisma.$queryRaw<{ lastId: string | null; scanned: number; seeded: number }[]>`
        WITH page AS (
          SELECT u."id" FROM "User" u WHERE u."id" > ${afterId} ORDER BY u."id" LIMIT ${BATCH_SIZE}
        ),
        written AS (
          UPDATE "User" u
          SET "lastActiveAt" = GREATEST(u."lastLoginAt", live."lastSessionAt")
          FROM page
          LEFT JOIN LATERAL (
            SELECT MAX(s."updated_at") AS "lastSessionAt"
            FROM "Session" s
            WHERE s."userId" = page."id" AND s."expires" > (now() AT TIME ZONE 'UTC')
          ) live ON true
          WHERE u."id" = page."id" AND u."lastActiveAt" IS NULL
            AND (u."lastLoginAt" IS NOT NULL OR live."lastSessionAt" IS NOT NULL)
          RETURNING u."id"
        )
        SELECT (SELECT MAX("id") FROM page) AS "lastId",
               (SELECT count(*)::int FROM page) AS "scanned",
               (SELECT count(*)::int FROM written) AS "seeded"
      `;
      seeded += batch.seeded;
      if (!batch.lastId || batch.scanned < BATCH_SIZE) break;
      afterId = batch.lastId;
    }

    logger.info(`User last-active backfill: ${seeded.toString()} users updated`);
  },
};
