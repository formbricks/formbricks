import { LRUCache } from "lru-cache";
import { ENTERPRISE_LICENSE_KEY, REDIS_HTTP_URL } from "@formbricks/lib/constants";
import { logger } from "@formbricks/logger";

interface Options {
  interval: number;
  allowedPerInterval: number;
}

const inMemoryRateLimiter = (options: Options) => {
  const tokenCache = new LRUCache<string, number>({
    max: 1000,
    ttl: options.interval * 1000, // converts to expected input of milliseconds
  });

  return (token: string) => {
    const currentUsage = tokenCache.get(token) ?? 0;
    if (currentUsage >= options.allowedPerInterval) {
      throw new Error("Rate limit exceeded");
    }
    tokenCache.set(token, currentUsage + 1);
  };
};

const redisRateLimiter = (options: Options) => async (token: string) => {
  try {
    if (!REDIS_HTTP_URL) {
      throw new Error("Redis HTTP URL is not set");
    }
    const tokenCountResponse = await fetch(`${REDIS_HTTP_URL}/INCR/${token}`);
    if (!tokenCountResponse.ok) {
      logger.error({ tokenCountResponse }, "Failed to increment token count in Redis");
      return;
    }

    const { INCR } = await tokenCountResponse.json();
    if (INCR === 1) {
      await fetch(`${REDIS_HTTP_URL}/EXPIRE/${token}/${options.interval.toString()}`);
    } else if (INCR > options.allowedPerInterval) {
      throw new Error();
    }
  } catch (e) {
    throw new Error("Rate limit exceeded for IP: " + token);
  }
};

export const rateLimit = (options: Options) => {
  if (REDIS_HTTP_URL && ENTERPRISE_LICENSE_KEY) {
    return redisRateLimiter(options);
  } else {
    return inMemoryRateLimiter(options);
  }
};
