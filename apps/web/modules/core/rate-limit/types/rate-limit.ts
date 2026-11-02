import { z } from "zod";

export const ZRateLimitConfig = z.object({
  /** Rate limit window in seconds */
  interval: z.int().positive().describe("Rate limit window in seconds"),
  /** Maximum allowed requests per interval */
  allowedPerInterval: z.int().positive().describe("Maximum allowed requests per interval"),
  /** Namespace for grouping rate limit per feature */
  namespace: z.string().min(1).describe("Namespace for grouping rate limit per feature"),
  /** Refuse instead of allow when the limiter cannot reach Redis (docs/adr/0015-abuse-limits-fail-closed.md) */
  failClosed: z
    .boolean()
    .optional()
    .describe("Refuse the request instead of allowing it when the limiter cannot reach Redis"),
});

export type TRateLimitConfig = z.infer<typeof ZRateLimitConfig>;

const ZRateLimitResponse = z.object({
  allowed: z.boolean().describe("Whether the request is allowed"),
  retryAfter: z.int().positive().optional().describe("Seconds until the current rate-limit window resets"),
});

export type TRateLimitResponse = z.infer<typeof ZRateLimitResponse>;
