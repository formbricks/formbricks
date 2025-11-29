import { IntegrationType } from "@prisma/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { getCacheService } from "@formbricks/cache";
import { prisma } from "@formbricks/database";
import { logger } from "@formbricks/logger";
import { sendTelemetryEvents } from "./telemetry";

// Mock dependencies
vi.mock("@formbricks/cache");
vi.mock("@formbricks/database", () => ({
  prisma: {
    organization: {
      findFirst: vi.fn(),
      count: vi.fn(),
    },
    user: { count: vi.fn() },
    team: { count: vi.fn() },
    project: { count: vi.fn() },
    survey: { count: vi.fn() },
    response: {
      count: vi.fn(),
      findFirst: vi.fn(),
    },
    display: { count: vi.fn() },
    contact: { count: vi.fn() },
    segment: { count: vi.fn() },
    integration: { findMany: vi.fn() },
    account: { findMany: vi.fn() },
    $queryRaw: vi.fn(),
  },
}));
vi.mock("@formbricks/logger", () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));
vi.mock("@/lib/env", () => ({
  env: {
    SMTP_HOST: "smtp.example.com",
    S3_BUCKET_NAME: "my-bucket",
    PROMETHEUS_ENABLED: true,
    RECAPTCHA_SITE_KEY: "site-key",
    RECAPTCHA_SECRET_KEY: "secret-key",
    GITHUB_ID: "github-id",
  },
}));

// Mock fetch
const fetchMock = vi.fn();
globalThis.fetch = fetchMock;

const mockCacheService = {
  get: vi.fn(),
  set: vi.fn(),
  tryLock: vi.fn(),
  del: vi.fn(),
};

describe("sendTelemetryEvents", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers();
    // Set a fixed time far in the past to ensure we can always send telemetry
    vi.setSystemTime(new Date("2024-01-01T00:00:00.000Z"));

    // Setup default cache behavior
    vi.mocked(getCacheService).mockResolvedValue({
      ok: true,
      data: mockCacheService as any,
    });
    mockCacheService.tryLock.mockResolvedValue({ ok: true, data: true }); // Lock acquired
    mockCacheService.del.mockResolvedValue({ ok: true, data: undefined });
    mockCacheService.get.mockResolvedValue({ ok: true, data: null }); // No last sent time
    mockCacheService.set.mockResolvedValue({ ok: true, data: undefined });

    // Setup default prisma behavior
    vi.mocked(prisma.organization.findFirst).mockResolvedValue({
      id: "org-123",
      createdAt: new Date("2023-01-01"),
    } as any);

    // Mock raw SQL query for counts (batched query)
    vi.mocked(prisma.$queryRaw).mockResolvedValue([
      {
        organizationCount: BigInt(1),
        userCount: BigInt(5),
        teamCount: BigInt(2),
        projectCount: BigInt(3),
        surveyCount: BigInt(10),
        inProgressSurveyCount: BigInt(4),
        completedSurveyCount: BigInt(6),
        responseCountAllTime: BigInt(100),
        responseCountSinceLastUpdate: BigInt(10),
        displayCount: BigInt(50),
        contactCount: BigInt(20),
        segmentCount: BigInt(4),
        newestResponseAt: new Date("2024-01-01T00:00:00.000Z"),
      },
    ] as any);

    // Mock other queries
    vi.mocked(prisma.integration.findMany).mockResolvedValue([{ type: IntegrationType.notion }] as any);
    vi.mocked(prisma.account.findMany).mockResolvedValue([{ provider: "github" }] as any);

    fetchMock.mockResolvedValue({ ok: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test("should send telemetry successfully when conditions are met", async () => {
    await sendTelemetryEvents();

    // Check lock acquisition
    expect(mockCacheService.tryLock).toHaveBeenCalledWith(
      "telemetry_lock",
      "locked",
      60 * 1000 // 1 minute TTL
    );

    // Check data gathering
    expect(prisma.organization.findFirst).toHaveBeenCalled();
    expect(prisma.$queryRaw).toHaveBeenCalled();

    // Check fetch call
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const payload = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(payload.organizationCount).toBe(1);
    expect(payload.userCount).toBe(5);
    expect(payload.integrations.notion).toBe(true);
    expect(payload.sso.github).toBe(true);

    // Check cache update (no TTL parameter)
    expect(mockCacheService.set).toHaveBeenCalledWith("telemetry_last_sent_ts", expect.any(String));

    // Check lock release
    expect(mockCacheService.del).toHaveBeenCalledWith(["telemetry_lock"]);
  });

  test("should skip if in-memory check fails", async () => {
    // Run once to set nextTelemetryCheck
    await sendTelemetryEvents();
    vi.clearAllMocks();

    // Run again immediately (should fail in-memory check)
    await sendTelemetryEvents();

    expect(getCacheService).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("should skip if Redis last sent time is recent", async () => {
    // Mock last sent time as recent
    const recentTime = Date.now() - 1000 * 60 * 60; // 1 hour ago
    mockCacheService.get.mockResolvedValue({ ok: true, data: String(recentTime) });

    await sendTelemetryEvents();

    expect(mockCacheService.tryLock).not.toHaveBeenCalled(); // No lock attempt
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("should skip if lock cannot be acquired", async () => {
    mockCacheService.tryLock.mockResolvedValue({ ok: true, data: false }); // Lock not acquired

    await sendTelemetryEvents();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(mockCacheService.del).not.toHaveBeenCalled(); // Shouldn't try to delete lock we didn't acquire
  });

  test("should handle cache service failure gracefully", async () => {
    vi.mocked(getCacheService).mockResolvedValue({
      ok: false,
      error: new Error("Cache error"),
    } as any);

    await sendTelemetryEvents();

    expect(fetchMock).not.toHaveBeenCalled();
    // Should verify that nextTelemetryCheck was updated, but it's a module variable.
    // We can infer it by running again and checking calls
    vi.clearAllMocks();
    await sendTelemetryEvents();
    expect(getCacheService).not.toHaveBeenCalled(); // Should be blocked by in-memory check
  });

  test("should handle telemetry send failure and apply cooldown", async () => {
    // Reset module to clear nextTelemetryCheck state from previous tests
    vi.resetModules();
    const { sendTelemetryEvents: freshSendTelemetryEvents } = await import("./telemetry");

    // Ensure we can acquire lock by setting last sent time far in the past
    const oldTime = Date.now() - 25 * 60 * 60 * 1000; // 25 hours ago
    mockCacheService.get.mockResolvedValue({ ok: true, data: String(oldTime) });
    mockCacheService.tryLock.mockResolvedValue({ ok: true, data: true }); // Lock acquired

    // Make fetch fail to trigger the catch block
    const networkError = new Error("Network error");
    fetchMock.mockRejectedValue(networkError);

    await freshSendTelemetryEvents();

    // Verify lock was acquired
    expect(mockCacheService.tryLock).toHaveBeenCalledWith("telemetry_lock", "locked", 60 * 1000);

    // The error should be caught in the inner catch block
    // The actual implementation logs as warning, not error
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        error: networkError,
        message: "Network error",
      }),
      "Failed to send telemetry - applying 1h cooldown"
    );

    // Lock should be released in finally block
    expect(mockCacheService.del).toHaveBeenCalledWith(["telemetry_lock"]);

    // Cache should not be updated on failure
    expect(mockCacheService.set).not.toHaveBeenCalled();

    // Verify cooldown: run again immediately (should be blocked by in-memory check)
    vi.clearAllMocks();
    mockCacheService.get.mockResolvedValue({ ok: true, data: null });
    mockCacheService.tryLock.mockResolvedValue({ ok: true, data: true });
    await freshSendTelemetryEvents();
    expect(getCacheService).not.toHaveBeenCalled(); // Should be blocked by in-memory check
  });

  test("should skip if no organization exists", async () => {
    // Reset module to clear nextTelemetryCheck state from previous tests
    vi.resetModules();
    const { sendTelemetryEvents: freshSendTelemetryEvents } = await import("./telemetry");

    // Ensure we can acquire lock by setting last sent time far in the past
    const oldTime = Date.now() - 25 * 60 * 60 * 1000; // 25 hours ago

    // Re-setup mocks after resetModules
    vi.mocked(getCacheService).mockResolvedValue({
      ok: true,
      data: mockCacheService as any,
    });
    mockCacheService.tryLock.mockResolvedValue({ ok: true, data: true }); // Lock acquired
    mockCacheService.del.mockResolvedValue({ ok: true, data: undefined });
    mockCacheService.get.mockResolvedValue({ ok: true, data: String(oldTime) });
    mockCacheService.set.mockResolvedValue({ ok: true, data: undefined });

    vi.mocked(prisma.organization.findFirst).mockResolvedValue(null);

    await freshSendTelemetryEvents();

    // sendTelemetry returns early when no org exists
    // Since it returns (not throws), the try block completes successfully
    // Then cache.set is called, and finally block executes
    expect(fetchMock).not.toHaveBeenCalled();

    // Verify lock was acquired (prerequisite for finally block to execute)
    expect(mockCacheService.tryLock).toHaveBeenCalledWith("telemetry_lock", "locked", 60 * 1000);

    // Lock should be released in finally block
    expect(mockCacheService.del).toHaveBeenCalledWith(["telemetry_lock"]);

    // Note: The current implementation calls cache.set even when no org exists
    // This might be a bug, but we test the actual behavior
    expect(mockCacheService.set).toHaveBeenCalled();
  });
});
