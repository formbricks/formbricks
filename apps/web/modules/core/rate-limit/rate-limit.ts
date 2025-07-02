import { RATE_LIMITING_DISABLED } from "@/lib/constants";
import { createCacheKey } from "@/modules/cache/lib/cacheKeys";
import redis from "@/modules/cache/redis";
import * as Sentry from "@sentry/nextjs";
import { logger } from "@formbricks/logger";
import { Result, ok } from "@formbricks/types/error-handlers";
import { TRateLimitConfig, type TRateLimitResponse } from "./types/rate-limit";

/**
 * Atomic Redis-based rate limiter using Lua scripts
 * Prevents race conditions in multi-pod Kubernetes environments
 */
export const checkRateLimit = async (
  config: TRateLimitConfig,
  identifier: string
): Promise<Result<TRateLimitResponse, string>> => {
  // Skip rate limiting if disabled or Redis unavailable
  if (RATE_LIMITING_DISABLED || !redis) {
    logger.debug(`Rate limiting disabled or Redis unavailable`);
    return ok({
      allowed: true,
    });
  }

  try {
    const now = Date.now();
    const windowStart = Math.floor(now / (config.interval * 1000)) * config.interval;
    const key = createCacheKey.rateLimit.core(config.namespace, identifier, windowStart);

    // Calculate TTL to expire exactly at window end, value in seconds
    const windowEnd = windowStart + config.interval;
    // Multiple by 1000 to convert to milliseconds (because Date.now() is in milliseconds) and divide by 1000 to convert back to seconds because we need the value in seconds for the Redis EXPIRE command
    const ttlSeconds = Math.ceil((windowEnd * 1000 - now) / 1000);

    // Lua script for atomic increment and conditional expire
    // This prevents race conditions between INCR and EXPIRE operations
    const luaScript = `
      local key = KEYS[1]
      local limit = tonumber(ARGV[1])
      local ttl = tonumber(ARGV[2])
      
      -- Atomically increment and get current count
      local current = redis.call('INCR', key)
      
      -- Set TTL only if this is the first increment (avoids extending windows)
      if current == 1 then
        redis.call('EXPIRE', key, ttl)
      end
      
      -- Return current count and whether it's within limit
      return {current, current <= limit and 1 or 0}
    `;

    const result = (await redis.eval(luaScript, 1, key, config.allowedPerInterval, ttlSeconds)) as [
      number,
      number,
    ];
    const [currentCount, isAllowed] = result;

    // Log debug information for every Redis count increase
    logger.debug(`Rate limit check`, {
      identifier,
      currentCount,
      limit: config.allowedPerInterval,
      window: config.interval,
      key,
      allowed: isAllowed === 1,
      windowEnd,
    });

    const response: TRateLimitResponse = {
      allowed: isAllowed === 1,
    };

    // Log rate limit violations for security monitoring
    if (!response.allowed) {
      const violationContext = {
        identifier,
        currentCount,
        limit: config.allowedPerInterval,
        window: config.interval,
        key,
        namespace: config.namespace,
      };

      logger.error(`Rate limit exceeded`, violationContext);

      // Breadcrumb because the exception will be captured in the error handler
      Sentry.addBreadcrumb({
        message: `Rate limit exceeded`,
        level: "warning",
        data: violationContext,
      });
    }

    return ok(response);
  } catch (error) {
    const errorMessage = `Rate limit check failed`;
    const errorContext = { error, identifier, namespace: config.namespace };

    logger.error(errorMessage, errorContext);

    // Log error to Sentry
    Sentry.captureException(error, {
      tags: {
        component: "rate-limiter",
        namespace: config.namespace,
      },
      extra: errorContext,
    });

    // Fail open - allow request if rate limiting fails
    // This ensures system availability over perfect rate limiting
    return ok({
      allowed: true,
    });
  }
};
