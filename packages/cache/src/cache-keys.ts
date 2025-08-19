import { type CacheKey, asCacheKey } from "../types/keys";

/**
 * Enterprise-grade cache key generator following industry best practices
 * Pattern: fb:\{resource\}:\{identifier\}[:\{subresource\}]
 *
 * Benefits:
 * - Clear namespace hierarchy (fb = formbricks)
 * - Collision-proof across environments
 * - Easy debugging and monitoring
 * - Predictable invalidation patterns
 * - Multi-tenant safe
 * - Type-safe with branded CacheKey type
 */

export const createCacheKey = {
  // Environment-related keys
  environment: {
    state: (environmentId: string): CacheKey => asCacheKey(`fb:env:${environmentId}:state`),
    config: (environmentId: string): CacheKey => asCacheKey(`fb:env:${environmentId}:config`),
    segments: (environmentId: string): CacheKey => asCacheKey(`fb:env:${environmentId}:segments`),
  },

  // Organization-related keys
  organization: {
    billing: (organizationId: string): CacheKey => asCacheKey(`fb:org:${organizationId}:billing`),
  },

  // License and enterprise features
  license: {
    status: (organizationId: string): CacheKey => asCacheKey(`fb:license:${organizationId}:status`),
    previous_result: (organizationId: string): CacheKey =>
      asCacheKey(`fb:license:${organizationId}:previous_result`),
  },

  // Rate limiting and security
  rateLimit: {
    core: (namespace: string, identifier: string, windowStart: number): CacheKey =>
      asCacheKey(`fb:rate_limit:${namespace}:${identifier}:${String(windowStart)}`),
  },

  // Custom keys with validation
  custom: (namespace: "analytics", identifier: string, subResource?: string): CacheKey => {
    const base = `fb:${namespace}:${identifier}`;
    return asCacheKey(subResource ? `${base}:${subResource}` : base);
  },
};
