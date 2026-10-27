import "server-only";
import type { Prisma } from "@formbricks/database/prisma";

/**
 * The database's clock, as a `Date`. Every data retention time that is compared with another — a
 * policy's `enabledAt`, a notice's `sentAt`, an exemption's `revokedAt`, a run's clock, a user's
 * `reactivatedAt` and `lastActiveAt` — comes from this one clock, so skew between app servers and the
 * database can't reorder them. `clock_timestamp()`, not
 * `now()` (the transaction's start), so a writer queued behind a lock stamps the moment it acts. Read
 * into the app and bound back as a parameter, never written with `clock_timestamp()` directly, which
 * would convert through the session's time zone into the `timestamp(3)` columns.
 *
 * Read as UTC wall-clock time (`AT TIME ZONE 'UTC'`, a `timestamp`), not as a `timestamptz`:
 * `@prisma/adapter-pg` relabels a `timestamptz`'s offset as `+00:00` without converting it, so on a
 * database whose session time zone isn't UTC (initdb copies the host's) the clock would come back
 * shifted by that offset against every column the app writes.
 */
export const readDatabaseClock = async (client: Pick<Prisma.TransactionClient, "$queryRaw">): Promise<Date> =>
  (await client.$queryRaw<{ now: Date }[]>`SELECT (clock_timestamp() AT TIME ZONE 'UTC') AS "now"`)[0].now;
