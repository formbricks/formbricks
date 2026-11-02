import { randomUUID } from "node:crypto";
import { createCacheKey } from "@formbricks/cache";
import { logger } from "@formbricks/logger";
import { cache } from "@/lib/cache";
import { RATE_LIMITING_DISABLED } from "@/lib/constants";
import type { TRateLimitConfig } from "./types/rate-limit";

/**
 * A limit on how many operations a principal has running at once, as opposed to how many it starts in a
 * window. A Redis sorted set per principal holds one member per running operation, scored by when its
 * lease runs out: acquiring first drops expired members, so a slot a crashed pod never released frees
 * itself after the lease, and the bound is exact at any moment — no window boundary to slip through.
 *
 * `config.allowedPerInterval` is how many may run at once, `config.interval` the lease in seconds: set it
 * past the longest the operation can run.
 */

export type TInFlightSlot = { key: string; member: string; released: boolean };

/** Redis's own clock, so pods with skewed clocks agree on which leases have run out. */
const ACQUIRE_SCRIPT = `
  local key = KEYS[1]
  local limit = tonumber(ARGV[1])
  local leaseMs = tonumber(ARGV[2])
  local member = ARGV[3]
  local time = redis.call('TIME')
  local now = tonumber(time[1]) * 1000 + math.floor(tonumber(time[2]) / 1000)

  redis.call('ZREMRANGEBYSCORE', key, '-inf', now)
  if redis.call('ZCARD', key) >= limit then
    return 0
  end
  redis.call('ZADD', key, now + leaseMs, member)
  redis.call('PEXPIRE', key, leaseMs)
  return 1
`;

/**
 * Take one of `identifier`'s slots, or learn that all are taken. Fails open — `allowed` with no slot to
 * release — when limiting is off or Redis cannot answer, like every limit here.
 */
export const acquireInFlightSlot = async (
  config: TRateLimitConfig,
  identifier: string
): Promise<{ allowed: boolean; slot?: TInFlightSlot }> => {
  if (RATE_LIMITING_DISABLED) return { allowed: true };

  try {
    const redis = await cache.getRedisClient();
    if (!redis) return { allowed: true };

    const key = createCacheKey.rateLimit.inFlight(config.namespace, identifier);
    const member = randomUUID();
    const acquired = await redis.eval(ACQUIRE_SCRIPT, {
      keys: [key],
      arguments: [String(config.allowedPerInterval), String(config.interval * 1000), member],
    });
    return acquired === 1 ? { allowed: true, slot: { key, member, released: false } } : { allowed: false };
  } catch (error) {
    logger.error({ error, namespace: config.namespace }, "In-flight limit check failed; allowing");
    return { allowed: true };
  }
};

/** Give a slot back. Best-effort and once only: a slot that is never released expires with its lease. */
export const releaseInFlightSlot = async (slot: TInFlightSlot): Promise<void> => {
  if (slot.released) return;
  slot.released = true;

  try {
    const redis = await cache.getRedisClient();
    await redis?.zRem(slot.key, slot.member);
  } catch (error) {
    logger.warn({ error }, "In-flight slot release failed; it frees itself when its lease runs out");
  }
};
