import { type CacheKey, type CustomCacheNamespace } from "@/types/keys";
import { makeCacheKey } from "./utils/key";

/**
 * Enterprise-grade cache key generator following industry best practices
 * Pattern: fb:\{resource\}:\{identifier\}:\{subResource\}
 *
 * Benefits:
 * - Clear namespace hierarchy (fb = formbricks)
 * - Collision-proof across workspaces
 * - Easy debugging and monitoring
 * - Predictable invalidation patterns
 * - Multi-tenant safe
 * - Type-safe with branded CacheKey type
 */

export const createCacheKey = {
  // Workspace-related keys
  workspace: {
    state: (workspaceId: string): CacheKey => makeCacheKey("env", workspaceId, "state"),
    config: (workspaceId: string): CacheKey => makeCacheKey("env", workspaceId, "config"),
    segments: (workspaceId: string): CacheKey => makeCacheKey("env", workspaceId, "segments"),
    languages: (workspaceId: string): CacheKey => makeCacheKey("env", workspaceId, "languages"),
  },

  // Organization-related keys
  organization: {
    billing: (organizationId: string): CacheKey => makeCacheKey("org", organizationId, "billing"),
  },

  // License and enterprise features
  license: {
    status: (organizationId: string): CacheKey => makeCacheKey("license", organizationId, "status"),
    previous_result: (organizationId: string): CacheKey =>
      makeCacheKey("license", organizationId, "previous_result"),
    fetch_lock: (organizationId: string): CacheKey => makeCacheKey("license", organizationId, "fetch_lock"),
  },

  // Response-related keys
  response: {
    countBySurveyId: (surveyId: string): CacheKey => makeCacheKey("response", surveyId, "count"),
  },

  // Hub-related keys
  hub: {
    feedbackRecordTenant: (recordId: string): CacheKey =>
      makeCacheKey("hub", recordId, "feedback_record_tenant"),
  },

  // Rate limiting and security
  rateLimit: {
    core: (namespace: string, identifier: string, windowStart: number): CacheKey =>
      makeCacheKey("rate_limit", namespace, identifier, String(windowStart)),
  },

  // Custom keys with validation
  custom: (namespace: CustomCacheNamespace, identifier: string, subResource?: string): CacheKey => {
    return subResource !== undefined
      ? makeCacheKey(namespace, identifier, subResource)
      : makeCacheKey(namespace, identifier);
  },
};
