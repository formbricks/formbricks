import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { ConcurrencyLimiter } from "@/app/lib/api/concurrency-limiter";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";
import {
  HEIC_CONVERSION_BODY_LIMIT_BYTES,
  HEIC_CONVERSION_MAX_IN_FLIGHT,
  HEIC_CONVERSION_MAX_IN_FLIGHT_PER_USER,
  HEIC_CONVERSION_RETRY_AFTER_SECONDS,
} from "./lib/constants";
import { convertHeicToJpegOperation } from "./lib/operations";
import { ZHeicConversionBody } from "./schemas";

// The decoder (heic-convert) works on Node buffers, so the route stays off the edge runtime.
export const runtime = "nodejs";

/** One per server process; the per-user share keeps one user from taking every slot. */
const conversionConcurrency = new ConcurrencyLimiter(HEIC_CONVERSION_MAX_IN_FLIGHT, {
  maxPerKey: HEIC_CONVERSION_MAX_IN_FLIGHT_PER_USER,
});

/**
 * `POST /api/internal/heic-conversions`: the file inputs' HEIC → JPEG conversion. Session-only, open to
 * every signed-in user, unaudited (it stores nothing), as the server action it replaces was.
 */
export const POST = withV3ApiWrapper({
  auth: "session",
  customRateLimitConfig: rateLimitConfigs.api.internalHeicConversion,
  bodyLimitBytes: HEIC_CONVERSION_BODY_LIMIT_BYTES,
  concurrency: { limiter: conversionConcurrency, retryAfterSeconds: HEIC_CONVERSION_RETRY_AFTER_SECONDS },
  schemas: { body: ZHeicConversionBody },
  handler: async ({ parsedInput, requestId, instance }) =>
    convertHeicToJpegOperation({ body: parsedInput.body, requestId, instance }),
});
