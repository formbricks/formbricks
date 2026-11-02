import "server-only";
import { metrics } from "@opentelemetry/api";

const meter = metrics.getMeter("formbricks.rate_limit");

/**
 * Every check the limiter could not make because Redis was unavailable. It is the alert signal for a Redis
 * outage: nothing else in the app turns one into a page, and the limiter is on almost every request path.
 */
const unavailableTotal = meter.createCounter("formbricks_rate_limiter_unavailable_total", {
  description: "Rate-limit checks that could not reach Redis, by whether the limit refused or allowed",
});

export type TRateLimiterUnavailableMetric = Readonly<{
  /** "closed" when the limit refused the request, "open" when it let it through unchecked. */
  failMode: "open" | "closed";
  /** "no_client" when no ready Redis client exists, "error" when a Redis call threw. */
  reason: "no_client" | "error";
}>;

export const recordRateLimiterUnavailable = (metric: TRateLimiterUnavailableMetric): void => {
  try {
    // Bounded values only: no namespace, no identifier. Which limit refused belongs in the log line.
    unavailableTotal.add(1, { fail_mode: metric.failMode, reason: metric.reason });
  } catch {
    // Telemetry must never alter the decision.
  }
};
