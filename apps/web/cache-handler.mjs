import { CacheHandler } from "@neshca/cache-handler";
import createLruHandler from "@neshca/cache-handler/local-lru";
import createRedisHandler from "@neshca/cache-handler/redis-stack";
// or if you are using Redis without the RedisJSON module
// import createRedisHandler from '@neshca/cache-handler/redis-strings';
import { createClient } from "redis";

CacheHandler.onCreation(async () => {
  console.log("Creating cache handler");
  let redisHandler;

  console.log("REDIS_HTTP_CLIENT_URL", process.env.REDIS_HTTP_CLIENT_URL);
  if (process.env.REDIS_HTTP_CLIENT_URL) {
    console.log("Creating Redis handler");
    const client = createClient({
      url: process.env.REDIS_HTTP_CLIENT_URL,
    });

    client.on("error", () => {});

    await client.connect();
    console.log("Connected to Redis");

    redisHandler = await createRedisHandler({
      client,
      timeoutMs: 5000,
    });
  }

  const localHandler = createLruHandler();
  console.log("Created local handler");

  return {
    handlers: [redisHandler, localHandler],
  };
});

export default CacheHandler;
