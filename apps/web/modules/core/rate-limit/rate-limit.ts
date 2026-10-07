import * as Sentry from "@sentry/nextjs";
import { createCacheKey } from "@formbricks/cache";
import { logger } from "@formbricks/logger";
import { Result, ok } from "@formbricks/types/error-handlers";
import { cache } from "@/lib/cache";
import { RATE_LIMITING_DISABLED, SENTRY_DSN } from "@/lib/constants";
import { TRateLimitConfig, type TRateLimitResponse } from "./types/rate-limit";

export type TRateLimitReservation = {
  identifier: string;
  key: string;
  namespace: string;
  requested: number;
  settled: boolean;
};

type TRateLimitReservationResponse = TRateLimitResponse & {
  reservation?: TRateLimitReservation;
};

const getRateLimitWindow = (config: TRateLimitConfig, identifier: string, now = Date.now()) => {
  const windowStart = Math.floor(now / (config.interval * 1000)) * config.interval;
  const key = createCacheKey.rateLimit.core(config.namespace, identifier, windowStart);
  const windowEnd = windowStart + config.interval;
  const ttlSeconds = Math.max(1, Math.ceil((windowEnd * 1000 - now) / 1000));

  return { key, windowEnd, ttlSeconds };
};

const buildRateLimitResponse = (
  config: TRateLimitConfig,
  currentCount: number,
  ttlSeconds: number
): TRateLimitResponse => {
  const allowed = currentCount < config.allowedPerInterval;

  return {
    allowed,
    retryAfter: allowed ? undefined : ttlSeconds,
  };
};

/**
 * Read the current rate limit usage without incrementing the counter.
 */
export const peekRateLimit = async (
  config: TRateLimitConfig,
  identifier: string
): Promise<Result<TRateLimitResponse, string>> => {
  if (RATE_LIMITING_DISABLED) {
    logger.debug(`Rate limiting disabled`);
    return ok({
      allowed: true,
    });
  }

  try {
    const redis = await cache.getRedisClient();
    if (!redis) {
      logger.debug(`Redis unavailable`);
      return ok({
        allowed: true,
      });
    }

    const { key, ttlSeconds } = getRateLimitWindow(config, identifier);
    const rawCount = await redis.get(key);
    const currentCount = rawCount ? Number.parseInt(rawCount, 10) : 0;
    const response = buildRateLimitResponse(config, currentCount, ttlSeconds);

    if (!response.allowed) {
      logger.error(
        {
          identifier,
          currentCount,
          limit: config.allowedPerInterval,
          window: config.interval,
          key,
          namespace: config.namespace,
        },
        `Rate limit exceeded`
      );
    }

    return ok(response);
  } catch (error) {
    const errorMessage = `Rate limit check failed`;
    const errorContext = { error, identifier, namespace: config.namespace };

    logger.error(errorContext, errorMessage);

    if (SENTRY_DSN) {
      Sentry.captureException(error, {
        tags: {
          component: "rate-limiter",
          namespace: config.namespace,
        },
        extra: errorContext,
      });
    }

    return ok({
      allowed: true,
    });
  }
};

const consumeRateLimit = async (
  config: TRateLimitConfig,
  identifier: string,
  requested: number,
  createReservation: boolean
): Promise<Result<TRateLimitReservationResponse, string>> => {
  if (!Number.isInteger(requested) || requested < 1) {
    throw new Error("Rate limit usage must be a positive integer");
  }

  // Skip rate limiting if disabled
  if (RATE_LIMITING_DISABLED) {
    logger.debug(`Rate limiting disabled`);
    return ok({
      allowed: true,
    });
  }

  try {
    // Get Redis client
    const redis = await cache.getRedisClient();
    if (!redis) {
      logger.debug(`Redis unavailable`);
      return ok({
        allowed: true,
      });
    }

    const { key, windowEnd, ttlSeconds } = getRateLimitWindow(config, identifier);

    // Lua script for atomic weighted increment and conditional expire.
    // Refusing before INCRBY prevents an oversized request from consuming the remaining budget.
    const luaScript = `
      local key = KEYS[1]
      local limit = tonumber(ARGV[1])
      local ttl = tonumber(ARGV[2])
      local requested = tonumber(ARGV[3])

      local current = tonumber(redis.call('GET', key) or '0')
      local next = current + requested

      if next > limit then
        return {next, 0}
      end

      local updated = redis.call('INCRBY', key, requested)

      -- Set TTL only when creating the counter (avoids extending windows)
      if current == 0 then
        redis.call('EXPIRE', key, ttl)
      end

      return {updated, 1}
    `;

    const result = (await redis.eval(luaScript, {
      keys: [key],
      arguments: [config.allowedPerInterval.toString(), ttlSeconds.toString(), requested.toString()],
    })) as [number, number];
    const [currentCount, isAllowed] = result;

    // Log debug information for every Redis count increase
    logger.debug(
      {
        identifier,
        currentCount,
        limit: config.allowedPerInterval,
        window: config.interval,
        key,
        requested,
        allowed: isAllowed === 1,
        windowEnd,
      },
      `Rate limit check`
    );

    const response: TRateLimitReservationResponse = {
      allowed: isAllowed === 1,
      retryAfter: isAllowed === 1 ? undefined : ttlSeconds,
      reservation:
        isAllowed === 1 && createReservation
          ? {
              identifier,
              key,
              namespace: config.namespace,
              requested,
              settled: false,
            }
          : undefined,
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
        requested,
      };

      logger.error(violationContext, `Rate limit exceeded`);

      if (SENTRY_DSN) {
        // Breadcrumb because the exception will be captured in the error handler
        Sentry.addBreadcrumb({
          message: `Rate limit exceeded`,
          level: "warning",
          data: violationContext,
        });
      }
    }

    return ok(response);
  } catch (error) {
    const errorMessage = `Rate limit check failed`;
    const errorContext = { error, identifier, namespace: config.namespace };

    logger.error(errorContext, errorMessage);

    if (SENTRY_DSN) {
      // Log error to Sentry
      Sentry.captureException(error, {
        tags: {
          component: "rate-limiter",
          namespace: config.namespace,
        },
        extra: errorContext,
      });
    }

    // Fail open - allow request if rate limiting fails
    // This ensures system availability over perfect rate limiting
    return ok({
      allowed: true,
    });
  }
};

/**
 * Atomic Redis-based rate limiter using Lua scripts.
 * Prevents race conditions in multi-pod Kubernetes environments.
 */
export const checkRateLimit = async (
  config: TRateLimitConfig,
  identifier: string,
  requested = 1
): Promise<Result<TRateLimitResponse, string>> => {
  const result = await consumeRateLimit(config, identifier, requested, false);

  if (!result.ok) {
    return result;
  }

  return ok({
    allowed: result.data.allowed,
    retryAfter: result.data.retryAfter,
  });
};

/**
 * Reserve rate-limit capacity and return the exact fixed-window key that was charged.
 * The receipt can later be settled without risking a decrement in a newer window.
 */
export const reserveRateLimit = async (
  config: TRateLimitConfig,
  identifier: string,
  requested = 1
): Promise<Result<TRateLimitReservationResponse, string>> =>
  consumeRateLimit(config, identifier, requested, true);

/**
 * Settle a reservation to the number of successful units. Settlement is deliberately best-effort:
 * callers may already have persisted their work, so a Redis error must not turn that success into an
 * application error. The receipt is one-shot within the running process to prevent duplicate releases.
 */
export const settleRateLimit = async (
  reservation: TRateLimitReservation,
  successful: number
): Promise<void> => {
  if (!Number.isInteger(successful) || successful < 0 || successful > reservation.requested) {
    throw new Error("Successful rate limit usage must be an integer within the reserved amount");
  }

  if (reservation.settled) {
    return;
  }
  reservation.settled = true;

  const unused = reservation.requested - successful;
  if (unused === 0 || RATE_LIMITING_DISABLED) {
    return;
  }

  try {
    const redis = await cache.getRedisClient();
    if (!redis) {
      logger.debug(`Redis unavailable`);
      return;
    }

    const luaScript = `
      local key = KEYS[1]
      local unused = tonumber(ARGV[1])
      local current = tonumber(redis.call('GET', key) or '0')

      if current == 0 then
        return {0, 0}
      end

      local released = math.min(current, unused)
      local updated = current - released

      if updated == 0 then
        redis.call('DEL', key)
      else
        redis.call('DECRBY', key, released)
      end

      return {updated, released}
    `;

    const [currentCount, released] = (await redis.eval(luaScript, {
      keys: [reservation.key],
      arguments: [unused.toString()],
    })) as [number, number];

    logger.debug(
      {
        identifier: reservation.identifier,
        currentCount,
        key: reservation.key,
        namespace: reservation.namespace,
        released,
        requested: reservation.requested,
        successful,
      },
      `Rate limit reservation settled`
    );
  } catch (error) {
    const errorMessage = `Rate limit settlement failed`;
    const errorContext = {
      error,
      identifier: reservation.identifier,
      namespace: reservation.namespace,
      requested: reservation.requested,
      successful,
    };

    logger.error(errorContext, errorMessage);

    if (SENTRY_DSN) {
      Sentry.captureException(error, {
        tags: {
          component: "rate-limiter",
          namespace: reservation.namespace,
          operation: "settlement",
        },
        extra: errorContext,
      });
    }
  }
};
