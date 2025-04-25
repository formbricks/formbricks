import Redis from "ioredis";
import { parse, stringify } from "superjson";
import { logger } from "@formbricks/logger";
import { createRedisClient } from "./client";

export class RedisCache {
  private redis: Redis;
  private prefix: string;

  constructor(redis: Redis, prefix = "fb:") {
    this.redis = redis;
    this.prefix = prefix;
  }

  async get(key: string): Promise<string | null> {
    try {
      const data = await this.redis.get(this.prefix + key);
      return data;
    } catch (error) {
      logger.error(`Error getting cache for key ${key}`, error);
      return null;
    }
  }

  async set(key: string, value: string, ttlInSeconds?: number): Promise<void> {
    try {
      if (ttlInSeconds) {
        await this.redis.set(this.prefix + key, value, "EX", ttlInSeconds);
      } else {
        await this.redis.set(this.prefix + key, value);
      }
    } catch (error) {
      logger.error(`Error setting cache for key ${key}`, error);
    }
  }

  async del(key: string): Promise<void> {
    try {
      await this.redis.del(this.prefix + key);
    } catch (error) {
      logger.error(`Error deleting cache for key ${key}`, error);
    }
  }
}

export const cache = <T, P extends unknown[]>(
  fn: (...params: P) => Promise<T>,
  key: string,
  ttlInSeconds: number = 300
) => {
  const redis = new RedisCache(createRedisClient());

  const wrap = async (params: unknown[]): Promise<string> => {
    const result = await fn(...(params as P));
    return stringify(result);
  };

  const cachedFn = async (params: unknown[]) => {
    const cached = await redis.get(key);
    if (cached) {
      return cached;
    }

    const result = await wrap(params);
    await redis.set(key, result, ttlInSeconds);
    return result;
  };

  return async (...params: P): Promise<T> => {
    const result = await cachedFn(params);
    return parse(result);
  };
};
