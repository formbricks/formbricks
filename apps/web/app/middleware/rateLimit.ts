import { LRUCache } from "lru-cache";

import { REDIS_CLIENT_URL, WEBAPP_URL } from "@formbricks/lib/constants";

type Options = {
  interval: number;
  allowedPerInterval: number;
};

const inMemoryRateLimiter = (options: Options) => {
  const tokenCache = new LRUCache<string, number>({
    max: 1000,
    ttl: options.interval,
  });

  return async (token: string) => {
    const currentUsage = tokenCache.get(token) || 0;
    if (currentUsage >= options.allowedPerInterval) {
      throw new Error("Rate limit exceeded");
    }
    tokenCache.set(token, currentUsage + 1);
  };
};

const redisRateLimiter = (options: Options) => {
  return async (token: string) => {
    const tokenCountResponse = await fetch(
      `${WEBAPP_URL}/api/internal/cache?token=${token}&interval=${options.interval}&allowedPerInterval=${options.allowedPerInterval}`
    );
    const {
      data: { rateLimitExceeded },
    } = await tokenCountResponse.json();
    if (!tokenCountResponse.ok || rateLimitExceeded) {
      console.log("inside redis limiter", await tokenCountResponse.json());

      throw new Error("Rate limit exceeded for IP: " + token);
    }
  };
};

export default function rateLimit(options: Options) {
  if (REDIS_CLIENT_URL) {
    return redisRateLimiter(options);
  } else {
    return inMemoryRateLimiter(options);
  }
}
