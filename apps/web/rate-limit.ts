import { LRUCache } from "lru-cache";

type Options = {
  interval: number;
  allowedPerInterval: number;
};

export default function rateLimit(options: Options) {
  const tokenCache = new LRUCache({
    max: 1000, // Max 1000 unique IP sessions per 15 minutes
    ttl: options.interval,
  });

  return {
    check: (token: string) =>
      new Promise<void>((resolve, reject) => {
        const tokenCount = (tokenCache.get(token) as number[]) || [0];
        if (tokenCount[0] === 0) {
          tokenCache.set(token, tokenCount);
        }
        tokenCount[0] += 1;

        const currentUsage = tokenCount[0];
        const isRateLimited = currentUsage >= options.allowedPerInterval;
        return isRateLimited ? reject() : resolve();
      }),
  };
}
