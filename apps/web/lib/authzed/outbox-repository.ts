import "server-only";
import { randomUUID } from "node:crypto";
import { prisma } from "@formbricks/database";
import {
  AUTHZED_OUTBOX_TARGET_TYPES,
  type TAuthzedOutboxEvent,
  type TAuthzedOutboxStatus,
} from "./outbox-types";

export const AUTHZED_OUTBOX_MAX_ATTEMPTS = 20;
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

const getRetryDelayMs = (attempts: number): number => Math.min(5 * 60_000, 1_000 * 2 ** (attempts - 1));

export const markAuthzedOutboxEventsFailed = async (
  leaseOwner: string,
  events: ReadonlyArray<TAuthzedOutboxEvent>,
  errorCode: string
): Promise<number> => {
  let deadLettered = 0;
  for (const event of events) {
    const shouldDeadLetter = event.attempts >= AUTHZED_OUTBOX_MAX_ATTEMPTS;
    deadLettered += shouldDeadLetter ? 1 : 0;
    await prisma.authzedProjectionOutbox.updateMany({
      where: { id: event.id, leaseOwner, processedAt: null },
      data: {
        availableAt: new Date(Date.now() + getRetryDelayMs(event.attempts)),
        deadLetteredAt: shouldDeadLetter ? new Date() : null,
        lastErrorCode: errorCode,
        leaseExpiresAt: null,
        leasedAt: null,
        leaseOwner: null,
      },
    });
  }
  return deadLettered;
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

/** Indexed fail-closed check for the authorization hot path; avoid aggregating retained history. */
export const hasStaleAuthzedRevocation = async (): Promise<boolean> => {
  const [row] = await prisma.$queryRaw<TStaleRevocationRow[]>`
    SELECT EXISTS (
      SELECT 1
      FROM "AuthzedProjectionOutbox"
      WHERE "isRevocation" = true
        AND "processedAt" IS NULL
        AND ("deadLetteredAt" IS NOT NULL OR "createdAt" <= NOW() - INTERVAL '60 seconds')
    ) AS stale
  `;

  return row?.stale ?? false;
};

export const getAuthzedOutboxStatus = async (): Promise<TAuthzedOutboxStatus> => {
  const [row] = await prisma.$queryRaw<TStatusRow[]>`
    SELECT
      COUNT(*) FILTER (WHERE "processedAt" IS NULL AND "deadLetteredAt" IS NULL) AS pending,
      COUNT(*) FILTER (WHERE "deadLetteredAt" IS NOT NULL) AS dead_lettered,
      COUNT(*) FILTER (
        WHERE "processedAt" IS NULL AND "isRevocation" = true
          AND ("deadLetteredAt" IS NOT NULL OR "createdAt" <= NOW() - INTERVAL '60 seconds')
      ) AS overdue_revocations,
      COUNT(*) FILTER (
        WHERE "processedAt" IS NULL AND "isRevocation" = true
          AND ("deadLetteredAt" IS NOT NULL OR "createdAt" <= NOW() - INTERVAL '45 seconds')
      ) AS revocations_past_critical,
      COUNT(*) FILTER (
        WHERE "processedAt" IS NULL AND "isRevocation" = true
          AND ("deadLetteredAt" IS NOT NULL OR "createdAt" <= NOW() - INTERVAL '15 seconds')
      ) AS revocations_past_warning,
      EXTRACT(EPOCH FROM NOW() - MIN("createdAt") FILTER (
        WHERE "processedAt" IS NULL AND "deadLetteredAt" IS NULL
      ))::double precision AS oldest_pending_age_seconds
    FROM "AuthzedProjectionOutbox"
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
