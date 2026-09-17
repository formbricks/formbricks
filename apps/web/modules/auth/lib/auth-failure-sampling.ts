import "server-only";
import { createHash } from "node:crypto";
import { createCacheKey } from "@formbricks/cache";
import { cache } from "@/lib/cache";

const WINDOW_MS = 5 * 60 * 1000;

// Count the CURRENT attempt and update lastEmitted only when actually selecting an event.
// One atomic script avoids races between replicas and never mistakes the just-inserted attempt
// for the last emitted event. Counters in the next selected event describe the omitted attempts.
export const AUTH_FAILURE_SAMPLE_SCRIPT = `
local count = redis.call('HINCRBY', KEYS[1], 'count', 1)
local last = tonumber(redis.call('HGET', KEYS[1], 'lastEmitted') or '0')
local omitted = tonumber(redis.call('HGET', KEYS[1], 'omitted') or '0')
redis.call('PEXPIRE', KEYS[1], ARGV[2])
if count <= 3 or count % 10 == 0 or tonumber(ARGV[1]) - last >= 60000 then
  redis.call('HSET', KEYS[1], 'lastEmitted', ARGV[1], 'omitted', 0)
  return {1, count, omitted}
end
redis.call('HINCRBY', KEYS[1], 'omitted', 1)
return {0, count, omitted + 1}
`;

export const sampleAuthFailure = async (identifier: string) => {
  const now = Date.now();
  const bucket = Math.floor(now / WINDOW_MS) * WINDOW_MS;
  const key = createCacheKey.rateLimit.core(
    "auth-audit",
    createHash("sha256").update(identifier.toLowerCase()).digest("hex"),
    bucket
  );
  try {
    const redis = await cache.getRedisClient();
    if (!redis) throw new Error("sampling unavailable");
    const result = await redis.eval(AUTH_FAILURE_SAMPLE_SCRIPT, {
      keys: [key],
      arguments: [String(now), String(WINDOW_MS)],
    });
    if (!Array.isArray(result) || result.length !== 3 || !result.every((value) => typeof value === "number"))
      throw new Error("invalid sampling result");
    return {
      emit: result[0] === 1,
      attemptCount: result[1] as number,
      suppressedCount: result[2] as number,
      windowStart: bucket,
      samplingUnavailable: false,
    };
  } catch {
    // Fail OPEN for observability: every attempt is emitted during an outage, so lostCount is zero.
    return {
      emit: true,
      attemptCount: 1,
      suppressedCount: 0,
      windowStart: bucket,
      samplingUnavailable: true,
    };
  }
};
