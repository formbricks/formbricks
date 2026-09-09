import "server-only";
import { logger } from "@formbricks/logger";
import { cache } from "@/lib/cache";
import {
  IMPORT_AI_INFLIGHT_RETRY_AFTER_SECONDS,
  IMPORT_AI_INFLIGHT_TTL_SECONDS,
  IMPORT_AI_MAX_INFLIGHT_PER_USER,
} from "../limits";

export class ImportInProgressError extends Error {
  retryAfter = IMPORT_AI_INFLIGHT_RETRY_AFTER_SECONDS;

  constructor() {
    super("Another document import is still running. Wait for it to finish or stop it first.");
    this.name = "ImportInProgressError";
  }
}

export const aiInflightKey = (identifier: string) => `import:ai:inflight:${identifier}`;

/**
 * At most `IMPORT_AI_MAX_INFLIGHT_PER_USER` AI conversions per user or key at once, counted in Redis so
 * the guard holds across instances. Returns the release function; call it on done, error and abort.
 * Without Redis (tests, single-node dev without cache) the guard is a no-op — the rate limits still hold.
 */
export async function acquireAiImportSlot(identifier: string): Promise<() => Promise<void>> {
  const redis = await cache.getRedisClient();
  if (!redis) {
    return async () => undefined;
  }

  const key = aiInflightKey(identifier);
  let released = false;
  const release = async () => {
    if (released) return;
    released = true;
    try {
      const remaining = await redis.decr(key);
      if (remaining <= 0) await redis.del(key);
    } catch (error) {
      logger.warn({ error }, "Failed to release the AI import slot");
    }
  };

  let inflight: number;
  try {
    inflight = await redis.incr(key);
    await redis.expire(key, IMPORT_AI_INFLIGHT_TTL_SECONDS);
  } catch (error) {
    // Redis trouble must not block imports; the per-user AI rate limit still bounds the spend.
    logger.warn({ error }, "Failed to count in-flight AI imports");
    return async () => undefined;
  }

  if (inflight > IMPORT_AI_MAX_INFLIGHT_PER_USER) {
    await release();
    throw new ImportInProgressError();
  }

  return release;
}
