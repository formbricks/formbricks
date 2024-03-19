import { CacheHandler } from "@neshca/cache-handler";
import createLruHandler from "@neshca/cache-handler/local-lru";
// import createRedisHandler from "@neshca/cache-handler/redis-stack";
// or if you are using Redis without the RedisJSON module
import createRedisHandler from "@neshca/cache-handler/redis-strings";
import { createClient } from "redis";

CacheHandler.onCreation(async () => {
  let redisHandler;
  if (process.env.REDIS_HTTP_CLIENT_URL) {
    const client = createClient({
      url: process.env.REDIS_HTTP_CLIENT_URL,
    });
    client.on("error", () => {});

    await client.connect();
    redisHandler = createRedisHandler({
      client,
      timeoutMs: 5000,
    });
  }

  const localHandler = createLruHandler();
  return {
    handlers: [redisHandler, localHandler],
  };
});

export default CacheHandler;
