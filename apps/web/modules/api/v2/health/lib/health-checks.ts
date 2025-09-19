import { getCacheService } from "@formbricks/cache";
import { prisma } from "@formbricks/database";
import { logger } from "@formbricks/logger";
import { Result, err, ok } from "@formbricks/types/error-handlers";
import { type OverallHealthStatus } from "@/modules/api/v2/health/types/health-status";
import { type ApiErrorResponseV2 } from "@/modules/api/v2/types/api-error";

/**
 * Check if the main database is reachable and responding
 * @returns Promise<Result<boolean, ApiErrorResponseV2>> - Result of the database health check
 */
export const checkDatabaseHealth = async (): Promise<Result<boolean, ApiErrorResponseV2>> => {
  try {
    // Simple query to check if database is reachable
    await prisma.$queryRaw`SELECT 1`;
    return ok(true);
  } catch (error) {
    logger
      .withContext({
        component: "health_check",
        check_type: "main_database",
        error,
      })
      .error("Database health check failed");
    return err({
      type: "internal_server_error",
      details: [{ field: "main_database", issue: "Database health check failed" }],
    });
  }
};

/**
 * Check if the Redis cache is reachable and responding
 * @returns Promise<Result<boolean, ApiErrorResponseV2>> - Result of the cache health check
 */
export const checkCacheHealth = async (): Promise<Result<boolean, ApiErrorResponseV2>> => {
  try {
    const cacheServiceResult = await getCacheService();
    if (!cacheServiceResult.ok) {
      return err({
        type: "internal_server_error",
        details: [{ field: "cache_database", issue: "Cache service not available" }],
      });
    }

    const isAvailable = await cacheServiceResult.data.isRedisAvailable();
    if (isAvailable) {
      return ok(true);
    }

    return err({
      type: "internal_server_error",
      details: [{ field: "cache_database", issue: "Redis not available" }],
    });
  } catch (error) {
    logger
      .withContext({
        component: "health_check",
        check_type: "cache_database",
        error,
      })
      .error("Redis health check failed");
    return err({
      type: "internal_server_error",
      details: [{ field: "cache_database", issue: "Redis health check failed" }],
    });
  }
};

/**
 * Perform all health checks and return the overall status
 * Always returns ok() with health status unless the health check endpoint itself fails
 * @returns Promise<Result<OverallHealthStatus, ApiErrorResponseV2>> - Overall health status of all dependencies
 */
export const performHealthChecks = async (): Promise<Result<OverallHealthStatus, ApiErrorResponseV2>> => {
  try {
    const [databaseResult, cacheResult] = await Promise.all([checkDatabaseHealth(), checkCacheHealth()]);

    const healthStatus: OverallHealthStatus = {
      main_database: databaseResult.ok ? databaseResult.data : false,
      cache_database: cacheResult.ok ? cacheResult.data : false,
    };

    // Always return ok() with the health status - individual dependency failures
    // are reflected in the boolean values
    return ok(healthStatus);
  } catch (error) {
    // Only return err() if the health check endpoint itself fails
    logger
      .withContext({
        component: "health_check",
        error,
      })
      .error("Health check endpoint failed");

    return err({
      type: "internal_server_error",
      details: [{ field: "health", issue: "Failed to perform health checks" }],
    });
  }
};
