import { logger } from "@formbricks/logger";
// Applied migrations are frozen, so this import cannot change under us.
import { runUntilExhausted } from "../20261002120001_backfill_survey_owner/utils";
import type { MigrationScript } from "../../src/scripts/migration-runner";

const BATCH_SIZE = 5000;

/**
 * ENG-3612: seed `User.lastActiveAt` (added by the schema migration before this one) from the sessions
 * still valid, once, so someone who has stayed signed in since their last sign-in isn't counted from that
 * sign-in on the members policy's first night.
 *
 * Better Auth deletes a session on sign-out but an expired one only lazily, hence the `expires` filter.
 * `expires` is a UTC `timestamp`, so it is compared with UTC wall-clock time whatever the session time
 * zone. A user takes the newest `updated_at` of their live sessions.
 *
 * Batches go through the autocommit `prisma` handle rather than the runner's transaction, so each commits
 * on its own and "User" is never locked for the whole pass: sign-ins and session checks keep going. A
 * batch is the next users, by id, that still have no `lastActiveAt` and do have a live session, so every
 * batch falsifies its own predicate for the rows it writes: a rerun resumes, the loop ends, and an empty
 * database is a no-op. A user with no live session is never selected, so cannot keep a batch alive.
 *
 * The session hooks write `lastActiveAt` meanwhile (`recordUserActivity`: `GREATEST`, forward only). The
 * outer `"lastActiveAt" IS NULL` is re-checked on the row as it is locked, so a value a hook wrote first
 * is kept, and a hook writing after takes the later of the two. (Only if hooks beat the backfill to every
 * user of one batch would that batch count zero and end the loop early; the users left would then be
 * recorded by the same hook on their next session renewal.)
 *
 * No count of what is left is checked at the end: a user who signs in during the backfill gets a live
 * session that the hook records itself, so a strict "nothing left" check could fail a deploy over a race
 * it has nothing to do with.
 */
export const backfillUserLastActiveAt: MigrationScript = {
  type: "data",
  id: "fz8qkpnf0unlhlukw1hnjv7e",
  name: "20261007120001_backfill_user_last_active_at",
  run: async ({ prisma }) => {
    const { rows } = await runUntilExhausted(
      () =>
        prisma.$executeRaw`
        UPDATE "User" u
        SET "lastActiveAt" = b."lastSessionAt"
        FROM (
          SELECT s."userId", MAX(s."updated_at") AS "lastSessionAt"
          FROM "Session" s
          JOIN "User" pending ON pending."id" = s."userId" AND pending."lastActiveAt" IS NULL
          WHERE s."expires" > (now() AT TIME ZONE 'UTC')
          GROUP BY s."userId"
          ORDER BY s."userId"
          LIMIT ${BATCH_SIZE}
        ) b
        WHERE u."id" = b."userId" AND u."lastActiveAt" IS NULL
      `
    );

    logger.info(`User last-active backfill: ${rows.toString()} users updated`);
  },
};
