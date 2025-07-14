import { REDIS_URL } from "@/lib/constants";
import { createClient } from "redis";
import { logger } from "@formbricks/logger";

let connectionPromise: Promise<any> | null = null;

const createRedisConnection = async () => {
  if (!REDIS_URL) {
    logger.warn("REDIS_URL is not set");
    return null;
  }

  try {
    const client = createClient({ url: REDIS_URL });

    client.on("error", (err) => {
      logger.error("Redis client error", err);
    });

    client.on("disconnect", () => {
      logger.warn("Redis client disconnected");
    });

    client.on("reconnecting", () => {
      logger.info("Redis client reconnecting");
    });

    // Connect with timeout to prevent hanging
    const connectionTimeout = 5000; // 5 seconds
    await Promise.race([
      client.connect(),
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error("Redis connection timeout")), connectionTimeout);
      }),
    ]);

    logger.info("Redis connected successfully");
    return client;
  } catch (error) {
    logger.error("Failed to connect to Redis - Redis will be unavailable", error);
    return null;
  }
};

// Initialize connection promise
connectionPromise = createRedisConnection();

// Export function to get Redis client
export const getRedisClient = async () => {
  return await connectionPromise;
};

// For backward compatibility, export default as the getRedisClient function
export default getRedisClient;
