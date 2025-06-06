import { MANAGEMENT_API_RATE_LIMIT, RATE_LIMITING_DISABLED, UNKEY_ROOT_KEY } from "@/lib/constants";
import { ApiErrorResponseV2 } from "@/modules/api/v2/types/api-error";
import { type LimitOptions, Ratelimit, type RatelimitResponse } from "@unkey/ratelimit";
import { logger } from "@formbricks/logger";
import { Result, err, okVoid } from "@formbricks/types/error-handlers";

export type RateLimitHelper = {
  identifier: string;
  opts?: LimitOptions;
  /**
   * Using a callback instead of a regular return to provide headers even
   * when the rate limit is reached and an error is thrown.
   **/
  onRateLimiterResponse?: (response: RatelimitResponse) => void;
};

let warningDisplayed = false;

/** Prevent flooding the logs while testing/building */
function logOnce(message: string) {
  if (warningDisplayed) return;
  logger.warn(message);
  warningDisplayed = true;
}

export function rateLimiter() {
  if (RATE_LIMITING_DISABLED) {
    logOnce("Rate limiting disabled");
    return () => ({ success: true, limit: 10, remaining: 999, reset: 0 }) as RatelimitResponse;
  }

  if (!UNKEY_ROOT_KEY) {
    logOnce("Disabled due to not finding UNKEY_ROOT_KEY env variable");
    return () => ({ success: true, limit: 10, remaining: 999, reset: 0 }) as RatelimitResponse;
  }
  const timeout = {
    fallback: { success: true, limit: 10, remaining: 999, reset: 0 },
    ms: 5000,
  };

  const limiter = {
    api: new Ratelimit({
      rootKey: UNKEY_ROOT_KEY,
      namespace: "api",
      limit: MANAGEMENT_API_RATE_LIMIT.allowedPerInterval,
      duration: MANAGEMENT_API_RATE_LIMIT.interval * 1000,
      timeout,
    }),
  };

  async function rateLimit({ identifier, opts }: RateLimitHelper) {
    return await limiter.api.limit(identifier, opts);
  }

  return rateLimit;
}

export const checkRateLimitAndThrowError = async ({
  identifier,
  opts,
}: RateLimitHelper): Promise<Result<void, ApiErrorResponseV2>> => {
  const response = await rateLimiter()({ identifier, opts });
  const { success } = response;

  if (!success) {
    return err({
      type: "too_many_requests",
    });
  }
  return okVoid();
};
