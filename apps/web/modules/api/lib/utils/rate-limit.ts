import { type LimitOptions, Ratelimit, type RatelimitResponse } from "@unkey/ratelimit";
import { MANAGEMENT_API_RATE_LIMIT } from "@formbricks/lib/constants";
import { Result, err, okVoid } from "@formbricks/types/error-handlers";
import { ApiErrorResponse } from "@formbricks/types/errors";


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
  console.warn(message);
  warningDisplayed = true;
}

export function rateLimiter() {
  // const { UNKEY_ROOT_KEY } = process.env;

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
  onRateLimiterResponse,
  opts,
}: RateLimitHelper): Promise<Result<void, ApiErrorResponse>> => {
  const response = await rateLimiter()({ identifier, opts });
  const { success, reset } = response;

  if (onRateLimiterResponse) onRateLimiterResponse(response);

  const convertToSeconds = (ms: number) => Math.floor(ms / 1000);

  if (!success) {
    const secondsToWait = convertToSeconds(reset - Date.now());

    return err({
      code: "too_many_requests",
      message: `Rate limit exceeded. Try again in ${secondsToWait} seconds.`,
      status: 429,
    });
  }
  return okVoid();
};
