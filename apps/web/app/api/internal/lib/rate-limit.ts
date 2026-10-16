import "server-only";
import { TooManyRequestsError } from "@formbricks/types/errors";
import { problemTooManyRequests } from "@/app/api/v3/lib/response";
import { applyRateLimit } from "@/modules/core/rate-limit/helpers";
import type { TRateLimitConfig } from "@/modules/core/rate-limit/types/rate-limit";

type TProblemContext = { requestId: string; instance?: string };

/**
 * The 429 for a feature's own rate limit (an hourly email-change budget, a per-workspace write budget):
 * the limiter's message, which says to try again later, and when, in `Retry-After`. Not the wrapper's
 * mapping, which words a 429 as an upstream service briefly throttling.
 */
export const rateLimitedResponse = (error: TooManyRequestsError, { requestId, instance }: TProblemContext) =>
  problemTooManyRequests(requestId, error.message, error.retryAfter, instance);

/** Spend one unit of a feature's rate limit: null to go ahead, or the 429 to answer with. */
export async function applyRateLimitOrRespond(
  config: TRateLimitConfig,
  identifier: string,
  context: TProblemContext
): Promise<Response | null> {
  try {
    await applyRateLimit(config, identifier);
    return null;
  } catch (error) {
    if (error instanceof TooManyRequestsError) return rateLimitedResponse(error, context);
    throw error;
  }
}
