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
    if (ttl) {
      await client.set(key, value, { EX: ttl });
    } else {
      await client.set(key, value);
    }
  },
  delete: async (key: string): Promise<void> => {
    const client = await getClient();
    await client.del(key);
  },
};
