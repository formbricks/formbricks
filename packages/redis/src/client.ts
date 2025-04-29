import Redis, { RedisOptions } from "ioredis";
import { logger } from "@formbricks/logger";

type CreateRedisClientParams = {
  /**
   * connection timeout in milliseconds
   */
  connectTimeout?: number;
  maxRetriesPerRequest?: number;
};

// Singleton class to manage Redis connections
class RedisConnectionPool {
  private static instance: RedisConnectionPool;
  private redisClient: Redis | null = null;
  private connectionCount = 0;

  private constructor() {}

  public static getInstance(): RedisConnectionPool {
    if (!RedisConnectionPool.instance) {
      RedisConnectionPool.instance = new RedisConnectionPool();
    }
    return RedisConnectionPool.instance;
  }

  public getConnection(params?: CreateRedisClientParams): Redis {
    const url = process.env.REDIS_URL;
    if (!this.redisClient) {
      if (!url) {
        throw new Error("REDIS_URL is not set");
      }

      const config: Partial<RedisOptions> = {
        maxRetriesPerRequest: null,
        ...params,
      };

      this.redisClient = new Redis(url, config);
      this.connectionCount++;

      logger.info(`Redis connection created. Total connections: ${this.connectionCount}`);

      // Handle connection events
      this.redisClient.on("error", (err) => {
        logger.error(`Redis connection error: ${err.message}`);
      });

      this.redisClient.on("connect", () => {
        logger.info("Redis connection established");
      });
    }

    return this.redisClient;
  }

  public async closeConnection(): Promise<void> {
    if (this.redisClient) {
      logger.info("Closing Redis connection");
      const client = this.redisClient;
      this.redisClient = null;
      this.connectionCount--;
      await client.quit();
    }
  }

  public getConnectionStatus(): string | null {
    return this.redisClient?.status || null;
  }
}

export const createRedisClient = (params?: CreateRedisClientParams): Redis => {
  return RedisConnectionPool.getInstance().getConnection(params);
};

export const closeRedisConnection = (): Promise<void> => {
  return RedisConnectionPool.getInstance().closeConnection();
};

export const getRedisConnectionStatus = (): string | null => {
  return RedisConnectionPool.getInstance().getConnectionStatus();
};
