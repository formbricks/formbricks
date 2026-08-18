import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import {
  AUTHZED_OUTBOX_MAX_ATTEMPTS,
  claimAuthzedOutboxEvents,
  getAuthzedOutboxStatus,
  hasStaleAuthzedRevocation,
  markAuthzedOutboxEventsDelivered,
  markAuthzedOutboxEventsFailed,
  pruneAuthzedOutboxHistory,
  replayAuthzedOutboxDeadLetters,
} from "./outbox-repository";

vi.mock("@formbricks/database", () => ({
  prisma: {
    $queryRaw: vi.fn(),
    $executeRaw: vi.fn(),
    authzedProjectionOutbox: { updateMany: vi.fn() },
  },
}));

const row = (targetType: string) => ({
  attempts: 1,
  createdAt: new Date(0),
  id: `${targetType}-event`,
  isRevocation: true,
  primaryId: "private-primary",
  secondaryId: "private-secondary",
  targetType,
});

describe("AuthZed projection outbox repository", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.useRealTimers());

  test("dead-letters an unknown target instead of leaving it leased forever", async () => {
    vi.mocked(prisma.$queryRaw).mockResolvedValue([row("membership"), row("future_unknown_target")]);

    await expect(claimAuthzedOutboxEvents("lease-owner")).resolves.toEqual([row("membership")]);
    expect(prisma.authzedProjectionOutbox.updateMany).toHaveBeenCalledWith({
      where: {
        id: { in: ["future_unknown_target-event"] },
        leaseOwner: "lease-owner",
        processedAt: null,
      },
      data: {
        deadLetteredAt: expect.any(Date),
        lastErrorCode: "authzed_projection_invalid_event",
        leaseExpiresAt: null,
        leasedAt: null,
        leaseOwner: null,
      },
    });
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

  test("releases retryable work with bounded exponential backoff before attempt twenty", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-18T00:00:00.000Z"));
    const event = { ...row("membership"), attempts: 3 };
    vi.mocked(prisma.authzedProjectionOutbox.updateMany).mockResolvedValue({ count: 1 });

    await expect(markAuthzedOutboxEventsFailed("lease-owner", [event], "authzed_unavailable")).resolves.toBe(
      0
    );

    expect(prisma.authzedProjectionOutbox.updateMany).toHaveBeenCalledWith({
      where: { id: event.id, leaseOwner: "lease-owner", processedAt: null },
      data: {
        availableAt: new Date("2026-08-18T00:00:04.000Z"),
        deadLetteredAt: null,
        lastErrorCode: "authzed_unavailable",
        leaseExpiresAt: null,
        leasedAt: null,
        leaseOwner: null,
      },
    });
  });

  test("dead-letters the twentieth failed delivery", async () => {
    const event = { ...row("membership"), attempts: AUTHZED_OUTBOX_MAX_ATTEMPTS };
    vi.mocked(prisma.authzedProjectionOutbox.updateMany).mockResolvedValue({ count: 1 });

    await expect(markAuthzedOutboxEventsFailed("lease-owner", [event], "authzed_unavailable")).resolves.toBe(
      1
    );

    expect(prisma.authzedProjectionOutbox.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ deadLetteredAt: expect.any(Date) }),
      })
    );
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
      },
    ]);

    await expect(getAuthzedOutboxStatus()).resolves.toEqual({
      deadLettered: 2,
      oldestPendingAgeSeconds: 47,
      overdueRevocations: 1,
      pending: 11,
      revocationsPastCritical: 3,
      revocationsPastWarning: 5,
    });
  });

  test("uses a boolean result for the authorization freshness guard", async () => {
    vi.mocked(prisma.$queryRaw).mockResolvedValue([{ stale: true }]);

    await expect(hasStaleAuthzedRevocation()).resolves.toBe(true);
  });

  test("returns the bounded delivered-history cleanup count", async () => {
    vi.mocked(prisma.$executeRaw).mockResolvedValue(17);

    await expect(pruneAuthzedOutboxHistory()).resolves.toBe(17);
  });

  test("replays only undelivered dead letters from attempt zero", async () => {
    vi.mocked(prisma.authzedProjectionOutbox.updateMany).mockResolvedValue({ count: 4 });

    await expect(replayAuthzedOutboxDeadLetters()).resolves.toBe(4);

    expect(prisma.authzedProjectionOutbox.updateMany).toHaveBeenCalledWith({
      where: { deadLetteredAt: { not: null }, processedAt: null },
      data: {
        attempts: 0,
        availableAt: expect.any(Date),
        deadLetteredAt: null,
        lastErrorCode: null,
        leaseExpiresAt: null,
        leasedAt: null,
        leaseOwner: null,
      },
    });
  });
});
