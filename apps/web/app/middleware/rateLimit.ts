import { LRUCache } from "lru-cache";

import { REDIS_HTTP_INTERFACE_URL } from "@formbricks/lib/constants";

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

const redisRateLimiter = (options: Options) => async (token: string) => {
  try {
    console.log("isnide checker of redis rate limiter limiting token: ", token);

    const tokenCountResponse = await fetch(`${REDIS_HTTP_INTERFACE_URL}/INCR/${token}`);
    if (!tokenCountResponse.ok) {
      console.error("Failed to increment token count in Redis", tokenCountResponse);
      return;
    }

    const { INCR } = await tokenCountResponse.json();
    console.log("INCR: ", INCR);

    if (INCR === 1) {
      console.log("Setting expiry for token: ", token);

      await fetch(`${REDIS_HTTP_INTERFACE_URL}/EXPIRE/${token}/${options.interval}`);
    } else if (INCR > options.allowedPerInterval) {
      console.log("Rate limit exceeded for token: ", token);

      throw new Error();
    }
  } catch (e) {
    console.log("Rate limit exceeded for token: ", token);

    throw new Error("Rate limit exceeded for IP: " + token);
  }
};

export default function rateLimit(options: Options) {
  console.log("Rate limiting caller: ", REDIS_HTTP_INTERFACE_URL ? "Redis" : "In-memory");

  if (REDIS_HTTP_INTERFACE_URL) {
    console.log("Redis URL: ", REDIS_HTTP_INTERFACE_URL);
    return redisRateLimiter(options);
  } else {
    console.log("Using in-memory rate limiter");
    return inMemoryRateLimiter(options);
  }
}
