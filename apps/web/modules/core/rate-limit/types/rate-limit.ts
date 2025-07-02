import { z } from "zod";

export const ZRateLimitConfig = z.object({
  /** Rate limit window in seconds */
  interval: z.number().int().positive().describe("Rate limit window in seconds"),
  /** Maximum allowed requests per interval */
  allowedPerInterval: z.number().int().positive().describe("Maximum allowed requests per interval"),
  /** Namespace for grouping rate limit per feature */
  namespace: z.string().min(1).describe("Namespace for grouping rate limit per feature"),
});

export type TRateLimitConfig = z.infer<typeof ZRateLimitConfig>;

const ZRateLimitResponse = z.object({
  allowed: z.boolean().describe("Whether the request is allowed"),
});

export type TRateLimitResponse = z.infer<typeof ZRateLimitResponse>;
