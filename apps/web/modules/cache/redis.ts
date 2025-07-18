import { createClient } from "redis";
import { logger } from "@formbricks/logger";

type RedisClient = ReturnType<typeof createClient>;

const REDIS_URL = process.env.REDIS_URL;

let client: RedisClient | null = null;

if (REDIS_URL) {
  client = createClient({
    url: REDIS_URL,
    socket: {
      reconnectStrategy: (retries) => {
        logger.info(`Redis reconnection attempt ${retries}`);

        // For the first 5 attempts, use exponential backoff with max 5 second delay
        if (retries <= 5) {
          return Math.min(retries * 1000, 5000);
        }

        // After 5 attempts, use a longer delay but never give up
        // This ensures the client keeps trying to reconnect when Redis comes back online
        logger.info("Redis reconnection using extended delay (30 seconds)");
        return 30000; // 30 second delay for persistent reconnection attempts
      },
    },
  });

  client.on("error", (err) => {
    logger.error("Redis client error:", err);
  });

  client.on("connect", () => {
    logger.info("Redis client connected");
  });

  client.on("reconnecting", () => {
    logger.info("Redis client reconnecting");
  });

  client.on("ready", () => {
    logger.info("Redis client ready");
  });

  client.on("end", () => {
    logger.info("Redis client disconnected");
  });

  // Connect immediately
  client.connect().catch((err) => {
    logger.error("Initial Redis connection failed:", err);
  });
}

export const getRedisClient = (): RedisClient | null => {
  if (!client?.isReady) {
    logger.warn("Redis client not ready, operations will be skipped");
    return null;
  }
  return client;
};

export const disconnectRedis = async (): Promise<void> => {
  if (client) {
    await client.disconnect();
    client = null;
  }
};
