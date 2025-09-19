import { beforeEach, describe, expect, test, vi } from "vitest";
import { ErrorCode, getCacheService } from "@formbricks/cache";
import { prisma } from "@formbricks/database";
import { err, ok } from "@formbricks/types/error-handlers";
import { checkCacheHealth, checkDatabaseHealth, performHealthChecks } from "../health-checks";

// Mock dependencies
vi.mock("@formbricks/database", () => ({
  prisma: {
    $queryRaw: vi.fn(),
  },
}));

vi.mock("@formbricks/cache", () => ({
  getCacheService: vi.fn(),
  ErrorCode: {
    RedisConnectionError: "redis_connection_error",
  },
}));

vi.mock("@formbricks/logger", () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    withContext: vi.fn(() => ({
      error: vi.fn(),
      info: vi.fn(),
    })),
  },
}));

describe("Health Checks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Helper function to create a mock CacheService
  const createMockCacheService = (isRedisAvailable: boolean = true) => ({
    getRedisClient: vi.fn(),
    withTimeout: vi.fn(),
    get: vi.fn(),
    exists: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
    keys: vi.fn(),
    withCache: vi.fn(),
    flush: vi.fn(),
    tryGetCachedValue: vi.fn(),
    trySetCache: vi.fn(),
    isRedisAvailable: vi.fn().mockResolvedValue(isRedisAvailable),
  });

  describe("checkDatabaseHealth", () => {
    test("should return healthy when database query succeeds", async () => {
      vi.mocked(prisma.$queryRaw).mockResolvedValue([{ "?column?": 1 }]);

      const result = await checkDatabaseHealth();

      expect(result).toEqual({ ok: true, data: true });
      expect(prisma.$queryRaw).toHaveBeenCalledWith(["SELECT 1"]);
    });

    test("should return unhealthy when database query fails", async () => {
      const dbError = new Error("Database connection failed");
      vi.mocked(prisma.$queryRaw).mockRejectedValue(dbError);

      const result = await checkDatabaseHealth();

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe("internal_server_error");
        expect(result.error.details).toEqual([
          { field: "main_database", issue: "Database health check failed" },
        ]);
      }
    });

    test("should handle different types of database errors", async () => {
      const networkError = new Error("ECONNREFUSED");
      vi.mocked(prisma.$queryRaw).mockRejectedValue(networkError);

      const result = await checkDatabaseHealth();

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe("internal_server_error");
        expect(result.error.details).toEqual([
          { field: "main_database", issue: "Database health check failed" },
        ]);
      }
    });
  });

  describe("checkCacheHealth", () => {
    test("should return healthy when Redis is available", async () => {
      const mockCacheService = createMockCacheService(true);
      vi.mocked(getCacheService).mockResolvedValue(ok(mockCacheService as any));

      const result = await checkCacheHealth();

      expect(result).toEqual({ ok: true, data: true });
      expect(getCacheService).toHaveBeenCalled();
      expect(mockCacheService.isRedisAvailable).toHaveBeenCalled();
    });

    test("should return unhealthy when cache service fails to initialize", async () => {
      const cacheError = { code: ErrorCode.RedisConnectionError };
      vi.mocked(getCacheService).mockResolvedValue(err(cacheError));

      const result = await checkCacheHealth();

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe("internal_server_error");
        expect(result.error.details).toEqual([
          { field: "cache_database", issue: "Cache service not available" },
        ]);
      }
    });

    test("should return unhealthy when Redis is not available", async () => {
      const mockCacheService = createMockCacheService(false);
      vi.mocked(getCacheService).mockResolvedValue(ok(mockCacheService as any));

      const result = await checkCacheHealth();

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe("internal_server_error");
        expect(result.error.details).toEqual([{ field: "cache_database", issue: "Redis not available" }]);
      }
      expect(mockCacheService.isRedisAvailable).toHaveBeenCalled();
    });

    test("should handle Redis availability check exceptions", async () => {
      const mockCacheService = createMockCacheService(true);
      mockCacheService.isRedisAvailable.mockRejectedValue(new Error("Redis ping failed"));
      vi.mocked(getCacheService).mockResolvedValue(ok(mockCacheService as any));

      const result = await checkCacheHealth();

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe("internal_server_error");
        expect(result.error.details).toEqual([
          { field: "cache_database", issue: "Redis health check failed" },
        ]);
      }
    });

    test("should handle cache service initialization exceptions", async () => {
      const serviceException = new Error("Cache service unavailable");
      vi.mocked(getCacheService).mockRejectedValue(serviceException);

      const result = await checkCacheHealth();

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe("internal_server_error");
        expect(result.error.details).toEqual([
          { field: "cache_database", issue: "Redis health check failed" },
        ]);
      }
    });

    test("should verify isRedisAvailable is called asynchronously", async () => {
      const mockCacheService = createMockCacheService(true);
      vi.mocked(getCacheService).mockResolvedValue(ok(mockCacheService as any));

      await checkCacheHealth();

      // Verify the async method was called
      expect(mockCacheService.isRedisAvailable).toHaveBeenCalledTimes(1);
      expect(mockCacheService.isRedisAvailable).toReturnWith(Promise.resolve(true));
    });
  });

  describe("performHealthChecks", () => {
    test("should return all healthy when both checks pass", async () => {
      // Mock successful database check
      vi.mocked(prisma.$queryRaw).mockResolvedValue([{ "?column?": 1 }]);

      // Mock successful cache check
      const mockCacheService = createMockCacheService(true);
      vi.mocked(getCacheService).mockResolvedValue(ok(mockCacheService as any));

      const result = await performHealthChecks();

      expect(result).toEqual({
        ok: true,
        data: {
          main_database: true,
          cache_database: true,
        },
      });
    });

    test("should return mixed results when only database is healthy", async () => {
      // Mock successful database check
      vi.mocked(prisma.$queryRaw).mockResolvedValue([{ "?column?": 1 }]);

      // Mock failed cache check
      vi.mocked(getCacheService).mockResolvedValue(err({ code: ErrorCode.RedisConnectionError }));

      const result = await performHealthChecks();

      expect(result).toEqual({
        ok: true,
        data: {
          main_database: true,
          cache_database: false,
        },
      });
    });

    test("should return mixed results when only cache is healthy", async () => {
      // Mock failed database check
      vi.mocked(prisma.$queryRaw).mockRejectedValue(new Error("DB Error"));

      // Mock successful cache check
      const mockCacheService = createMockCacheService(true);
      vi.mocked(getCacheService).mockResolvedValue(ok(mockCacheService as any));

      const result = await performHealthChecks();

      expect(result).toEqual({
        ok: true,
        data: {
          main_database: false,
          cache_database: true,
        },
      });
    });

    test("should return all unhealthy when both checks fail", async () => {
      // Mock failed database check
      vi.mocked(prisma.$queryRaw).mockRejectedValue(new Error("DB Error"));

      // Mock failed cache check
      vi.mocked(getCacheService).mockResolvedValue(err({ code: ErrorCode.RedisConnectionError }));

      const result = await performHealthChecks();

      expect(result).toEqual({
        ok: true,
        data: {
          main_database: false,
          cache_database: false,
        },
      });
    });

    test("should run both checks in parallel", async () => {
      const dbPromise = new Promise((resolve) => setTimeout(() => resolve([{ "?column?": 1 }]), 100));
      const redisPromise = new Promise((resolve) => setTimeout(() => resolve(true), 100));

      vi.mocked(prisma.$queryRaw).mockReturnValue(dbPromise as any);

      const mockCacheService = createMockCacheService(true);
      mockCacheService.isRedisAvailable.mockReturnValue(redisPromise as any);
      vi.mocked(getCacheService).mockResolvedValue(ok(mockCacheService as any));

      const startTime = Date.now();
      await performHealthChecks();
      const endTime = Date.now();

      // Should complete in roughly 100ms (parallel) rather than 200ms (sequential)
      expect(endTime - startTime).toBeLessThan(150);
    });

    test("should return error only on catastrophic failure (endpoint itself fails)", async () => {
      // Mock a catastrophic failure in Promise.all itself
      const originalPromiseAll = Promise.all;
      vi.spyOn(Promise, "all").mockRejectedValue(new Error("Catastrophic system failure"));

      const result = await performHealthChecks();

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe("internal_server_error");
        expect(result.error.details).toEqual([{ field: "health", issue: "Failed to perform health checks" }]);
      }

      // Restore original Promise.all
      Promise.all = originalPromiseAll;
    });
  });
});
