import "server-only";
import { logger } from "@formbricks/logger";
import { getCache } from "./service";

/**
 * Simple cache wrapper for functions that return promises
 */

type CacheOptions = {
  key: string;
  ttl: number;
  serialize?: (data: any) => string;
  deserialize?: (data: string) => any;
};

/**
 * Simple cache wrapper for functions that return promises
 *
 * @example
 * ```typescript
 * const getCachedEnvironment = withCache(
 *   () => fetchEnvironmentFromDB(environmentId),
 *   {
 *     key: `env:${environmentId}`,
 *     ttl: 3600 // 1 hour
 *   }
 * );
 * ```
 */
export const withCache = <T>(fn: () => Promise<T>, options: CacheOptions): (() => Promise<T>) => {
  return async (): Promise<T> => {
    const { key, ttl, serialize = JSON.stringify, deserialize = JSON.parse } = options;

    try {
      const cache = await getCache();

      // Try to get from cache
      const cached = await cache.get<string>(key);

      if (cached !== null && cached !== undefined) {
        return deserialize(cached);
      }

      // Cache miss - fetch fresh data
      const fresh = await fn();

      // Cache the result
      await cache.set(key, serialize(fresh), ttl);

      return fresh;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));

      // On cache error, still try to fetch fresh data
      logger.warn("Cache operation failed, fetching fresh data", { key, error: err });
      return fn();
    }
  };
};

/**
 * Simple cache invalidation helper
 * Prefer explicit key invalidation over complex tag systems
 */
export const invalidateCache = async (keys: string | string[]): Promise<void> => {
  const cache = await getCache();
  const keyArray = Array.isArray(keys) ? keys : [keys];

  await Promise.all(keyArray.map((key) => cache.del(key)));

  logger.info("Cache invalidated", { keys: keyArray });
};

/**
 * Enterprise-grade cache key generator following industry best practices
 * Pattern: fb:{resource}:{identifier}[:{subresource}]
 *
 * Benefits:
 * - Clear namespace hierarchy (fb = formbricks)
 * - Collision-proof across environments
 * - Easy debugging and monitoring
 * - Predictable invalidation patterns
 * - Multi-tenant safe
 */
export const createCacheKey = {
  // Environment-related keys
  environment: {
    state: (environmentId: string) => `fb:env:${environmentId}:state`,
    surveys: (environmentId: string) => `fb:env:${environmentId}:surveys`,
    actionClasses: (environmentId: string) => `fb:env:${environmentId}:action_classes`,
    config: (environmentId: string) => `fb:env:${environmentId}:config`,
  },

  // Organization-related keys
  organization: {
    billing: (organizationId: string) => `fb:org:${organizationId}:billing`,
    environments: (organizationId: string) => `fb:org:${organizationId}:environments`,
    config: (organizationId: string) => `fb:org:${organizationId}:config`,
    limits: (organizationId: string) => `fb:org:${organizationId}:limits`,
  },

  // License and enterprise features
  license: {
    status: (organizationId: string) => `fb:license:${organizationId}:status`,
    features: (organizationId: string) => `fb:license:${organizationId}:features`,
    usage: (organizationId: string) => `fb:license:${organizationId}:usage`,
    check: (organizationId: string, feature: string) => `fb:license:${organizationId}:check:${feature}`,
  },

  // User-related keys
  user: {
    profile: (userId: string) => `fb:user:${userId}:profile`,
    preferences: (userId: string) => `fb:user:${userId}:preferences`,
    organizations: (userId: string) => `fb:user:${userId}:organizations`,
    permissions: (userId: string, organizationId: string) =>
      `fb:user:${userId}:org:${organizationId}:permissions`,
  },

  // Project-related keys
  project: {
    config: (projectId: string) => `fb:project:${projectId}:config`,
    environments: (projectId: string) => `fb:project:${projectId}:environments`,
    surveys: (projectId: string) => `fb:project:${projectId}:surveys`,
  },

  // Survey-related keys
  survey: {
    metadata: (surveyId: string) => `fb:survey:${surveyId}:metadata`,
    responses: (surveyId: string) => `fb:survey:${surveyId}:responses`,
    stats: (surveyId: string) => `fb:survey:${surveyId}:stats`,
  },

  // Session and authentication
  session: {
    data: (sessionId: string) => `fb:session:${sessionId}:data`,
    permissions: (sessionId: string) => `fb:session:${sessionId}:permissions`,
  },

  // Rate limiting and security
  rateLimit: {
    api: (identifier: string, endpoint: string) => `fb:rate_limit:api:${identifier}:${endpoint}`,
    login: (identifier: string) => `fb:rate_limit:login:${identifier}`,
  },

  // Custom keys with validation
  custom: (namespace: string, identifier: string, subResource?: string) => {
    // Validate namespace to prevent collisions
    const validNamespaces = ["temp", "analytics", "webhook", "integration", "backup"];
    if (!validNamespaces.includes(namespace)) {
      throw new Error(`Invalid cache namespace: ${namespace}. Use: ${validNamespaces.join(", ")}`);
    }

    const base = `fb:${namespace}:${identifier}`;
    return subResource ? `${base}:${subResource}` : base;
  },
};
