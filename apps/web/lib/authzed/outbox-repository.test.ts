import { prisma } from "@/lib/__mocks__/database";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import {
  AUTHZED_OUTBOX_HISTORY_DELETE_BATCH_SIZE,
  AUTHZED_OUTBOX_HISTORY_MAX_DELETE_BATCHES,
  claimAuthzedOutboxEvents,
  getAuthzedOutboxStatus,
  hasStaleAuthzedRevocation,
  markAuthzedOutboxEventsDelivered,
  markAuthzedOutboxEventsFailed,
  pruneAuthzedOutboxHistory,
  queueAuthzedOutboxEvents,
  replayAuthzedOutboxDeadLetters,
} from "./outbox-repository";
import { AUTHZED_OUTBOX_TARGET_TYPES } from "./outbox-types";

const row = (targetType: string) => ({
  attempts: 1,
  createdAt: new Date(0),
  id: `${targetType}-event`,
  isRevocation: true,
  primaryId: "private-primary",
  secondaryId: "private-secondary",
  targetType,
});

/**
 * The release statement binds exactly one boolean: "this failure is attributable to one event".
 * Located by type rather than by position so reordering the SQL cannot silently invert the check.
 */
const boundPermanentFlag = (): unknown =>
  (vi.mocked(prisma.$queryRaw).mock.calls.at(-1) ?? [])
    .slice(1)
    .find((value: unknown) => typeof value === "boolean");

describe("AuthZed projection outbox repository", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.useRealTimers());

  // That an unknown type is left untouched for a newer worker is checked on real Postgres in
  // `outbox-trigger.integration.test.ts` ("claims the types this release knows …").
  test("returns the claimed events, and dead-letters nothing itself", async () => {
    vi.mocked(prisma.$queryRaw).mockResolvedValue([row("membership")]);

    await expect(claimAuthzedOutboxEvents("lease-owner")).resolves.toEqual([row("membership")]);
    expect(prisma.authzedProjectionOutbox.updateMany).not.toHaveBeenCalled();
  });

  test("marks only events owned by the active lease as delivered", async () => {
    vi.mocked(prisma.authzedProjectionOutbox.updateMany).mockResolvedValue({ count: 1 });

    await markAuthzedOutboxEventsDelivered("lease-owner", ["event-1", "event-2"]);

    expect(prisma.authzedProjectionOutbox.updateMany).toHaveBeenCalledWith({
      where: {
        id: { in: ["event-1", "event-2"] },
        leaseOwner: "lease-owner",
        processedAt: null,
      },
      data: {
        lastErrorCode: null,
        leaseExpiresAt: null,
        leasedAt: null,
        leaseOwner: null,
        processedAt: expect.any(Date),
      },
    });
  });

  // The backoff schedule and the dead-letter threshold are computed in SQL from each row's own
  // `attempts`, so they are only observable against a real PostgreSQL — see
  // outbox-trigger.integration.test.ts. What matters here is the attribution rule that decides
  // whether a failure is allowed to count towards dead-lettering at all.
  test("charges a permanent failure only when one event failed on its own", async () => {
    vi.mocked(prisma.$queryRaw).mockResolvedValue([{ dead_lettered: 1n }]);

    await expect(
      markAuthzedOutboxEventsFailed("lease-owner", ["event-1"], "authzed_invalid_request", {
        attributable: true,
        retryable: false,
      })
    ).resolves.toBe(1);

    expect(boundPermanentFlag()).toBe(true);
  });

  test("never charges a permanent failure for a retryable fault or an unattributed group", async () => {
    vi.mocked(prisma.$queryRaw).mockResolvedValue([{ dead_lettered: 0n }]);

    for (const attribution of [
      { attributable: true, retryable: true },
      { attributable: false, retryable: false },
      { attributable: false, retryable: true },
    ]) {
      await expect(
        markAuthzedOutboxEventsFailed(
          "lease-owner",
          ["event-1", "event-2"],
          "authzed_unavailable",
          attribution
        )
      ).resolves.toBe(0);

      expect(boundPermanentFlag()).toBe(false);
    }
  });

  test("releases a whole failed batch in one statement", async () => {
    vi.mocked(prisma.$queryRaw).mockResolvedValue([{ dead_lettered: 0n }]);

    await markAuthzedOutboxEventsFailed(
      "lease-owner",
      Array.from({ length: 200 }, (_unused, index) => `event-${String(index)}`),
      "authzed_unavailable",
      { attributable: false, retryable: true }
    );

    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
  });

  test("does not reach the database when nothing failed", async () => {
    await expect(
      markAuthzedOutboxEventsFailed("lease-owner", [], "authzed_unavailable", {
        attributable: false,
        retryable: true,
      })
    ).resolves.toBe(0);

    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });

  test("normalizes aggregate status values without exposing source rows", async () => {
    vi.mocked(prisma.$queryRaw).mockResolvedValue([
      {
        dead_lettered: 2n,
        oldest_pending_age_seconds: 47.9,
        overdue_revocations: 1n,
        pending: 11n,
        revocations_past_critical: 3n,
        revocations_past_warning: 5n,
        unknown_type: 4n,
      },
    ]);

    await expect(getAuthzedOutboxStatus()).resolves.toEqual({
      deadLettered: 2,
      oldestPendingAgeSeconds: 47,
      overdueRevocations: 1,
      pending: 11,
      revocationsPastCritical: 3,
      revocationsPastWarning: 5,
      unknownType: 4,
    });
  });

  test("uses a boolean result for the authorization freshness guard", async () => {
    vi.mocked(prisma.$queryRaw).mockResolvedValue([{ stale: true }]);

    await expect(hasStaleAuthzedRevocation()).resolves.toBe(true);
  });

  test("returns the delivered-history cleanup count across bounded batches", async () => {
    vi.mocked(prisma.$executeRaw)
      .mockResolvedValueOnce(10_000)
      .mockResolvedValueOnce(10_000)
      .mockResolvedValueOnce(17);

    await expect(pruneAuthzedOutboxHistory()).resolves.toBe(20_017);
    expect(prisma.$executeRaw).toHaveBeenCalledTimes(3);
  });

  test("bounds one delivered-history cleanup run", async () => {
    vi.mocked(prisma.$executeRaw).mockResolvedValue(AUTHZED_OUTBOX_HISTORY_DELETE_BATCH_SIZE);

    await expect(pruneAuthzedOutboxHistory()).resolves.toBe(
      AUTHZED_OUTBOX_HISTORY_DELETE_BATCH_SIZE * AUTHZED_OUTBOX_HISTORY_MAX_DELETE_BATCHES
    );
    expect(prisma.$executeRaw).toHaveBeenCalledTimes(AUTHZED_OUTBOX_HISTORY_MAX_DELETE_BATCHES);
  });

  test("replays only undelivered dead letters from attempt zero", async () => {
    vi.mocked(prisma.authzedProjectionOutbox.updateMany).mockResolvedValue({ count: 4 });

    await expect(replayAuthzedOutboxDeadLetters()).resolves.toBe(4);

    expect(prisma.authzedProjectionOutbox.updateMany).toHaveBeenCalledWith({
      where: {
        deadLetteredAt: { not: null },
        processedAt: null,
        targetType: { in: [...AUTHZED_OUTBOX_TARGET_TYPES] },
      },
      data: {
        attempts: 0,
        availableAt: expect.any(Date),
        deadLetteredAt: null,
        lastErrorCode: null,
        leaseExpiresAt: null,
        leasedAt: null,
        leaseOwner: null,
        permanentFailures: 0,
      },
    });
  });
});

describe("queueAuthzedOutboxEvents", () => {
  test("queues one event per id, not as a revocation", async () => {
    vi.mocked(prisma.authzedProjectionOutbox.createMany).mockResolvedValue({ count: 2 });

    await queueAuthzedOutboxEvents("mcp_grant", ["grant-1", "grant-2"]);

    expect(prisma.authzedProjectionOutbox.createMany).toHaveBeenCalledWith({
      data: [
        { targetType: "mcp_grant", primaryId: "grant-1", isRevocation: false },
        { targetType: "mcp_grant", primaryId: "grant-2", isRevocation: false },
      ],
    });
  });

  test("queues nothing for no ids", async () => {
    vi.mocked(prisma.authzedProjectionOutbox.createMany).mockClear();

    await queueAuthzedOutboxEvents("mcp_grant", []);

    expect(prisma.authzedProjectionOutbox.createMany).not.toHaveBeenCalled();
  });
});
