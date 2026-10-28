import type { TRateLimitConfig } from "@/modules/core/rate-limit/types/rate-limit";

/**
 * Feedback queries run Cube SQL over a whole dataset, so they get a bucket of their own on top of the v3
 * default: 30 per minute per caller, applied by the operation so the HTTP route and the MCP tool share one
 * budget. An agent iterating on a query stays well inside it; a loop does not. It is deliberately far below
 * the 600 per minute the dashboards design sized for a page of widgets, because an agent has no page to
 * render. Raise it with a measured reason, not a hunch.
 */
export const FEEDBACK_QUERY_RATE_LIMIT: TRateLimitConfig = {
  interval: 60,
  allowedPerInterval: 30,
  namespace: "api:v3:feedback-queries",
};
