import "server-only";
import { randomUUID } from "node:crypto";
import { prisma } from "@formbricks/database";
import {
  AUTHZED_OUTBOX_TARGET_TYPES,
  type TAuthzedOutboxEvent,
  type TAuthzedOutboxStatus,
} from "./outbox-types";

/**
 * Attempts after which the retry backoff stops growing.
 *
 * This is a bound on the exponent, not a dead-letter budget: `attempts` keeps climbing while SpiceDB
 * is unreachable, and `2 ^ attempts` would overflow long before anyone noticed.
 */
export const AUTHZED_OUTBOX_MAX_BACKOFF_ATTEMPTS = 20;
export const AUTHZED_OUTBOX_MAX_RETRY_DELAY_MS = 5 * 60_000;

/**
 * Non-retryable failures, attributable to one event alone, before it dead-letters.
 *
 * Deliberately separate from `attempts`. A dead-lettered revocation arms the fail-closed freshness
 * guard for the whole deployment, so reaching it must mean "PostgreSQL removed access and we cannot
 * make SpiceDB agree" — never "SpiceDB was down for an hour". Retryable failures and group failures
 * therefore leave this untouched; only an event that failed on its own has earned a permanent mark.
 * With the backoff below that is roughly 17 minutes of solitary failure, well past the 45-second
 * critical alarm.
 */
export const AUTHZED_OUTBOX_MAX_PERMANENT_FAILURES = 10;
export const AUTHZED_OUTBOX_LEASE_MS = 60_000;
export const AUTHZED_OUTBOX_REVOCATION_MAX_AGE_MS = 60_000;
export const AUTHZED_OUTBOX_BATCH_SIZE = 200;
export const AUTHZED_OUTBOX_HISTORY_RETENTION_DAYS = 7;
export const AUTHZED_OUTBOX_HISTORY_DELETE_BATCH_SIZE = 10_000;
const INVALID_EVENT_ERROR_CODE = "authzed_projection_invalid_event";

type TClaimedRow = Omit<TAuthzedOutboxEvent, "targetType"> & { targetType: string };

const isTargetType = (value: string): value is TAuthzedOutboxEvent["targetType"] =>
  (AUTHZED_OUTBOX_TARGET_TYPES as readonly string[]).includes(value);

export const createAuthzedOutboxLeaseOwner = (): string => randomUUID();

export const claimAuthzedOutboxEvents = async (
  leaseOwner: string,
  limit = AUTHZED_OUTBOX_BATCH_SIZE
): Promise<ReadonlyArray<TAuthzedOutboxEvent>> => {
  const rows = await prisma.$queryRaw<TClaimedRow[]>`
    WITH claimable AS (
      SELECT "id"
      FROM "AuthzedProjectionOutbox"
      WHERE "processedAt" IS NULL
        AND "deadLetteredAt" IS NULL
        AND "availableAt" <= NOW()
        AND ("leaseExpiresAt" IS NULL OR "leaseExpiresAt" <= NOW())
      ORDER BY "isRevocation" DESC, "createdAt" ASC
      LIMIT ${limit}
      FOR UPDATE SKIP LOCKED
    )
    UPDATE "AuthzedProjectionOutbox" AS outbox
    SET "attempts" = outbox."attempts" + 1,
        "lastAttemptAt" = NOW(),
        "leasedAt" = NOW(),
        "leaseExpiresAt" = NOW() + (${AUTHZED_OUTBOX_LEASE_MS} * INTERVAL '1 millisecond'),
        "leaseOwner" = ${leaseOwner},
        "updatedAt" = NOW()
    FROM claimable
    WHERE outbox."id" = claimable."id"
    RETURNING outbox."id", outbox."targetType", outbox."primaryId", outbox."secondaryId",
              outbox."isRevocation", outbox."attempts", outbox."createdAt"
  `;

  const invalidIds = rows.filter(({ targetType }) => !isTargetType(targetType)).map(({ id }) => id);
  if (invalidIds.length > 0) {
    // A manually inserted or corrupted event must not remain silently leased forever. Dead-letter it
    // without logging its identifiers; an invalid revocation will then activate the freshness guard.
    await prisma.authzedProjectionOutbox.updateMany({
      where: { id: { in: invalidIds }, leaseOwner, processedAt: null },
      data: {
        deadLetteredAt: new Date(),
        lastErrorCode: INVALID_EVENT_ERROR_CODE,
        leaseExpiresAt: null,
        leasedAt: null,
        leaseOwner: null,
      },
    });
  }

  return rows.flatMap((row) =>
    isTargetType(row.targetType) ? [{ ...row, targetType: row.targetType }] : []
  );
};

export const markAuthzedOutboxEventsDelivered = async (
  leaseOwner: string,
  eventIds: ReadonlyArray<string>
): Promise<void> => {
  if (eventIds.length === 0) return;
  await prisma.authzedProjectionOutbox.updateMany({
    where: { id: { in: [...eventIds] }, leaseOwner, processedAt: null },
    data: {
      lastErrorCode: null,
      leaseExpiresAt: null,
      leasedAt: null,
      leaseOwner: null,
      processedAt: new Date(),
    },
  });
};

/**
 * Release a failed lease, and dead-letter only what the failure actually attributes.
 *
 * `isolated` says the attempt covered this event and nothing else. A group failure reports that the
 * group did not deliver, not which member broke it, so it must never spend a permanent failure —
 * otherwise one poison event walks its whole batch to dead letter, and a dead-lettered revocation is
 * a deployment-wide authorization outage.
 *
 * One statement rather than one per event: this path runs when delivery is already failing, which is
 * exactly when the database is least likely to have headroom for 200 sequential round trips. The
 * backoff is computed from each row's own `attempts` so nothing has to be grouped by attempt count.
 */
export const markAuthzedOutboxEventsFailed = async (
  leaseOwner: string,
  eventIds: ReadonlyArray<string>,
  errorCode: string,
  { isolated, retryable }: Readonly<{ isolated: boolean; retryable: boolean }>
): Promise<number> => {
  if (eventIds.length === 0) return 0;
  const permanent = !retryable && isolated;

  const [row] = await prisma.$queryRaw<ReadonlyArray<{ dead_lettered: bigint }>>`
    WITH released AS (
      UPDATE "AuthzedProjectionOutbox"
      SET "availableAt" = NOW() + (
            LEAST(
              ${AUTHZED_OUTBOX_MAX_RETRY_DELAY_MS}::double precision,
              1000 * 2 ^ (LEAST("attempts", ${AUTHZED_OUTBOX_MAX_BACKOFF_ATTEMPTS}) - 1)
            ) * INTERVAL '1 millisecond'
          ),
          "permanentFailures" = "permanentFailures" + ${permanent ? 1 : 0},
          "deadLetteredAt" = CASE
            WHEN ${permanent}::boolean
             AND "permanentFailures" + 1 >= ${AUTHZED_OUTBOX_MAX_PERMANENT_FAILURES}
            THEN NOW()
            ELSE NULL
          END,
          "lastErrorCode" = ${errorCode},
          "leaseExpiresAt" = NULL,
          "leasedAt" = NULL,
          "leaseOwner" = NULL,
          -- Raw SQL bypasses Prisma's @updatedAt, which the previous per-event updateMany got free.
          "updatedAt" = NOW()
      WHERE "id" = ANY(${[...eventIds]}::text[])
        AND "leaseOwner" = ${leaseOwner}
        AND "processedAt" IS NULL
      RETURNING "deadLetteredAt"
    )
    SELECT COUNT(*) FILTER (WHERE "deadLetteredAt" IS NOT NULL) AS dead_lettered FROM released
  `;

  return Number(row?.dead_lettered ?? 0);
};

type TStatusRow = Readonly<{
  dead_lettered: bigint;
  oldest_pending_age_seconds: number | null;
  overdue_revocations: bigint;
  pending: bigint;
  revocations_past_critical: bigint;
  revocations_past_warning: bigint;
}>;

type TStaleRevocationRow = Readonly<{ stale: boolean }>;

/**
 * Indexed fail-closed check for the authorization hot path; avoid aggregating retained history.
 *
 * Two `EXISTS` rather than one with an `OR`, because the two halves live in different partial
 * indexes: `_claim_idx` covers `deadLetteredAt IS NULL` and `_dead_letter_idx` covers the complement,
 * and no single index can serve both sides of that disjunction. Split, each branch is an index probe
 * and the second is skipped whenever the first already answered.
 */
export const hasStaleAuthzedRevocation = async (): Promise<boolean> => {
  const [row] = await prisma.$queryRaw<TStaleRevocationRow[]>`
    SELECT (
      EXISTS (
        SELECT 1
        FROM "AuthzedProjectionOutbox"
        WHERE "isRevocation" = true
          AND "processedAt" IS NULL
          AND "deadLetteredAt" IS NULL
          AND "createdAt" <= NOW() - INTERVAL '60 seconds'
      )
      OR EXISTS (
        SELECT 1
        FROM "AuthzedProjectionOutbox"
        WHERE "isRevocation" = true
          AND "processedAt" IS NULL
          AND "deadLetteredAt" IS NOT NULL
      )
    ) AS stale
  `;

  return row?.stale ?? false;
};

/**
 * Aggregate outbox health.
 *
 * Scoped to undelivered rows by the outer `WHERE`, which is what keeps this off the seven days of
 * retained history: the delivery job calls it every five seconds, so an unscoped aggregate is a
 * full-table scan twelve times a minute. `dead_lettered` is unaffected by the scoping — a
 * dead-lettered row always has a NULL `processedAt`, because the claim skips dead letters and
 * `replayAuthzedOutboxDeadLetters` clears `deadLetteredAt` before delivery is possible again.
 */
export const getAuthzedOutboxStatus = async (): Promise<TAuthzedOutboxStatus> => {
  const [row] = await prisma.$queryRaw<TStatusRow[]>`
    SELECT
      COUNT(*) FILTER (WHERE "deadLetteredAt" IS NULL) AS pending,
      COUNT(*) FILTER (WHERE "deadLetteredAt" IS NOT NULL) AS dead_lettered,
      COUNT(*) FILTER (
        WHERE "isRevocation" = true
          AND ("deadLetteredAt" IS NOT NULL OR "createdAt" <= NOW() - INTERVAL '60 seconds')
      ) AS overdue_revocations,
      COUNT(*) FILTER (
        WHERE "isRevocation" = true
          AND ("deadLetteredAt" IS NOT NULL OR "createdAt" <= NOW() - INTERVAL '45 seconds')
      ) AS revocations_past_critical,
      COUNT(*) FILTER (
        WHERE "isRevocation" = true
          AND ("deadLetteredAt" IS NOT NULL OR "createdAt" <= NOW() - INTERVAL '15 seconds')
      ) AS revocations_past_warning,
      EXTRACT(EPOCH FROM NOW() - MIN("createdAt") FILTER (
        WHERE "deadLetteredAt" IS NULL
      ))::double precision AS oldest_pending_age_seconds
    FROM "AuthzedProjectionOutbox"
    WHERE "processedAt" IS NULL
  `;

  return {
    deadLettered: Number(row?.dead_lettered ?? 0),
    oldestPendingAgeSeconds:
      row?.oldest_pending_age_seconds === null || row?.oldest_pending_age_seconds === undefined
        ? null
        : Math.max(0, Math.floor(row.oldest_pending_age_seconds)),
    overdueRevocations: Number(row?.overdue_revocations ?? 0),
    pending: Number(row?.pending ?? 0),
    revocationsPastCritical: Number(row?.revocations_past_critical ?? 0),
    revocationsPastWarning: Number(row?.revocations_past_warning ?? 0),
  };
};

export const replayAuthzedOutboxDeadLetters = async (): Promise<number> => {
  const result = await prisma.authzedProjectionOutbox.updateMany({
    where: { deadLetteredAt: { not: null }, processedAt: null },
    data: {
      attempts: 0,
      availableAt: new Date(),
      deadLetteredAt: null,
      lastErrorCode: null,
      leaseExpiresAt: null,
      leasedAt: null,
      leaseOwner: null,
      // Reset alongside `attempts`: a replay is a decision that the cause was addressed, so the event
      // gets the full permanent-failure budget again rather than dead-lettering on its next failure.
      permanentFailures: 0,
    },
  });
  return result.count;
};

/** Bound table growth without deleting pending or dead-letter evidence. */
export const pruneAuthzedOutboxHistory = async (): Promise<number> =>
  prisma.$executeRaw`
    WITH expired AS (
      SELECT "id"
      FROM "AuthzedProjectionOutbox"
      WHERE "processedAt" < NOW() - (${AUTHZED_OUTBOX_HISTORY_RETENTION_DAYS} * INTERVAL '1 day')
      ORDER BY "processedAt" ASC
      LIMIT ${AUTHZED_OUTBOX_HISTORY_DELETE_BATCH_SIZE}
    )
    DELETE FROM "AuthzedProjectionOutbox" AS outbox
    USING expired
    WHERE outbox."id" = expired."id"
  `;
