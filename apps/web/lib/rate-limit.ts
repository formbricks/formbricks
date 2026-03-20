import "server-only";
import { headers } from "next/headers";
import { RATE_LIMITING_DISABLED } from "@/lib/constants";

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

// In-memory rate limiter (suitable for single-instance deployments)
// For multi-instance deployments, replace with Redis-based implementation
const rateLimitMap = new Map<string, RateLimitEntry>();

// Cleanup stale entries periodically
const CLEANUP_INTERVAL_MS = 60_000;
let lastCleanup = Date.now();

const cleanup = () => {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;
  lastCleanup = now;

  for (const [key, entry] of rateLimitMap.entries()) {
    if (entry.resetAt < now) {
      rateLimitMap.delete(key);
    }
  }
};

/**
 * Simple rate limiter for public endpoints.
 * Returns true if the request is allowed, false if rate limited.
 */
export const checkRateLimit = async (
  identifier: string,
  maxRequests: number = 30,
  windowMs: number = 60_000
): Promise<boolean> => {
  if (RATE_LIMITING_DISABLED) return true;

  cleanup();

  const now = Date.now();
  const entry = rateLimitMap.get(identifier);

  if (!entry || entry.resetAt < now) {
    rateLimitMap.set(identifier, { count: 1, resetAt: now + windowMs });
    return true;
  }

  entry.count++;
  if (entry.count > maxRequests) {
    return false;
  }

  return true;
};

/**
 * Get the client IP from request headers for rate limiting.
 */
export const getClientIpForRateLimit = async (): Promise<string> => {
  const headersList = await headers();
  return (
    headersList.get("x-forwarded-for")?.split(",")[0]?.trim() || headersList.get("x-real-ip") || "unknown"
  );
};
