import { createClient } from "redis";

import { REDIS_HTTP_CLIENT_URL } from "@formbricks/lib/constants";

const client = createClient({
  url: REDIS_HTTP_CLIENT_URL!,
});
client.on("error", (err) => console.log("Redis Client Error", err));
client.connect();

type Options = {
  interval: number;
  allowedPerInterval: number;
};

export const redisRateLimiter = (options: Options) => {
  return async (token: string) => {
    console.log("Redis Rate Limiter", token, options.interval, options.allowedPerInterval);

    const tokenCount = await client.INCR(token);
    console.log("Redis Token", token, " Count", tokenCount);

    if (tokenCount === 1) {
      console.log("Setting expiry for token", token, options.interval / 1000);

      await client.EXPIRE(token, options.interval / 1000);
      console.log("Expiry set for token", token, options.interval / 1000);
    }
    if (tokenCount > options.allowedPerInterval) {
      throw new Error("Rate limit exceeded for IP: " + token);
    }
    console.log("Redis Rate Limiter Done", token, options.interval, options.allowedPerInterval);

    return;
  };
};
