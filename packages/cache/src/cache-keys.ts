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
    /**
     * Which of the creatives a client events request names it may count for (ENG-4000), keyed by the
     * workspace id the SDK sends and a hash of the set of creative ids.
     */
    creativeIds: (workspaceId: string, creativeIdsHash: string): CacheKey =>
      makeCacheKey("env", workspaceId, "creative-ids", creativeIdsHash),
  },

  // Creative counters (ENG-4000): one UTC day's running totals, which the flush job copies to
  // Postgres, and the sets of creatives with totals not yet copied. Counters, not a cache: they carry a
  // TTL of about two days and are never invalidated.
  creativeStats: {
    devices: (day: string, creativeId: string): CacheKey =>
      makeCacheKey("creative-stats", day, creativeId, "devices"),
    pages: (day: string, creativeId: string): CacheKey =>
      makeCacheKey("creative-stats", day, creativeId, "pages"),
    pending: (day: string): CacheKey => makeCacheKey("creative-stats", day, "pending"),
    flushing: (day: string): CacheKey => makeCacheKey("creative-stats", day, "flushing"),
  },

  // Organization-related keys
  organization: {
    billing: (organizationId: string): CacheKey => makeCacheKey("org", organizationId, "billing"),
    // Single-flight lock so only one process refreshes an org's stale billing snapshot at a time.
    billingSyncLock: (organizationId: string): CacheKey =>
      makeCacheKey("org", organizationId, "billing-sync-lock"),
  },

  // License and enterprise features
  license: {
    status: (organizationId: string): CacheKey => makeCacheKey("license", organizationId, "status"),
    previous_result: (organizationId: string): CacheKey =>
      makeCacheKey("license", organizationId, "previous_result"),
    fetch_lock: (organizationId: string): CacheKey => makeCacheKey("license", organizationId, "fetch_lock"),
  },

  // Custom CSS (ENG-2949, ENG-3552)
  customCss: {
    /**
     * Output of reprocessing stored source under the current processor. Keyed by the processor version and
     * a hash of the source, so a processor or policy change can never be answered from an older entry.
     */
    reprocessed: (scope: "workspace" | "survey", processorVersion: number, sourceHash: string): CacheKey =>
      makeCacheKey("custom-css", scope, `v${String(processorVersion)}`, sourceHash),
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
    // A sorted set of the operations a principal has running now, for a limit on how many run at once.
    inFlight: (namespace: string, identifier: string): CacheKey =>
      makeCacheKey("rate_limit", namespace, identifier, "in_flight"),
  },

  // Survey import (ENG-6850): an `Idempotency-Key` the import dialog sent with a create, scoped to the
  // user who sent it and hashed, mapped to the request it was first used for and the survey it created.
  // Not a cache: it lives 24 hours and is never invalidated.
  surveyImport: {
    idempotency: (userId: string, keyHash: string): CacheKey =>
      makeCacheKey("survey_import", userId, "idempotency", keyHash),
  },

  // Custom keys with validation
  custom: (namespace: CustomCacheNamespace, identifier: string, subResource?: string): CacheKey => {
    return subResource !== undefined
      ? makeCacheKey(namespace, identifier, subResource)
      : makeCacheKey(namespace, identifier);
  },
};
