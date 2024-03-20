import { createClient } from "redis";

import { REDIS_CLIENT_URL } from "@formbricks/lib/constants";

const client = createClient({
  url: REDIS_CLIENT_URL!,
});
client.on("error", (err) => console.error("Redis Client Error", err));
client.connect();

type Options = {
  interval: number;
  allowedPerInterval: number;
};

export const redisRateLimiter = (options: Options) => {
  return async (token: string) => {
    const tokenCount = await client.INCR(token);
    if (tokenCount === 1) {
      await client.EXPIRE(token, options.interval / 1000);
    }
    if (tokenCount > options.allowedPerInterval) {
      throw new Error("Rate limit exceeded for IP: " + token);
    }
    return;
  };
};
