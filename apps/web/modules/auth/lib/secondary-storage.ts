import "server-only";
import { createClient } from "redis";
import { logger } from "@formbricks/logger";
import { env } from "@/lib/env";

/**
 * Better Auth `secondaryStorage` backed by Redis (ENG-1054).
 *
 * Stores sessions (alongside the DB — see `session.storeSessionInDatabase` in auth.ts),
 * verification records, and rate-limit counters. A dedicated connection keeps Better Auth's
 * storage independent of the @formbricks/cache CacheService (which wraps its own client with
 * serialization/namespacing we don't want for raw BA values).
 *
 * Connects lazily on first use; a failed connect is not memoized so the next call can retry.
 */
type RedisClient = ReturnType<typeof createClient>;

let clientPromise: Promise<RedisClient> | undefined;

const getClient = (): Promise<RedisClient> => {
  if (!clientPromise) {
    const client = createClient({ url: env.REDIS_URL, socket: { connectTimeout: 3000 } });
    client.on("error", (error) => logger.error(error, "Better Auth Redis secondary storage error"));
    clientPromise = client
      .connect()
      .then(() => client)
      .catch((error) => {
        clientPromise = undefined; // allow a retry on the next call
        throw error;
      });
  }
  return clientPromise;
};

export const redisSecondaryStorage = {
  get: async (key: string): Promise<string | null> => {
    const client = await getClient();
    return client.get(key);
  },
  set: async (key: string, value: string, ttl?: number): Promise<void> => {
    const client = await getClient();
    if (ttl !== undefined) {
      await client.set(key, value, { EX: ttl });
    } else {
      await client.set(key, value);
    }
  },
  delete: async (key: string): Promise<void> => {
    const client = await getClient();
    await client.del(key);
  },
  // Atomic single-use consumption (verification / password-reset tokens) across instances. Without
  // this, Better Auth falls back to a per-process lock that can't span pods, so a token could be
  // consumed twice under concurrent requests on different instances.
  getAndDelete: async (key: string): Promise<string | null> => {
    const client = await getClient();
    return client.getDel(key);
  },
  // Atomic rate-limit counter across instances. INCR + EXPIRE-on-first-write run in a single Lua eval
  // so a crash between the two can't leave a TTL-less (never-expiring) counter that would wedge the
  // limit at max forever. Mirrors the atomic INCR/EXPIRE pattern in
  // modules/core/rate-limit/rate-limit.ts. TTL (seconds) is applied only on creation.
  increment: async (key: string, ttl: number): Promise<number> => {
    const client = await getClient();
    const count = await client.eval(
      `local count = redis.call('INCR', KEYS[1])
if count == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end
return count`,
      { keys: [key], arguments: [String(ttl)] }
    );
    return Number(count);
  },
};
