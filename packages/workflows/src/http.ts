/**
 * Shared HTTP header helpers for v3 workflow responses (both success envelopes and problem
 * details). Centralized so the cache directive and the standard header set are defined once.
 * Mirrors the headers used by `apps/web/app/api/v3/lib/response.ts`.
 */

export const CACHE_CONTROL_NO_STORE = "private, no-store";

export const buildV3Headers = (
  contentType: string,
  requestId: string,
  extra?: Record<string, string>
): Record<string, string> => ({
  "Content-Type": contentType,
  "Cache-Control": CACHE_CONTROL_NO_STORE,
  "X-Request-Id": requestId,
  ...extra,
});
