import "server-only";

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
    const validNamespaces = ["temp", "analytics", "webhook", "integration", "backup", "license"];
    if (!validNamespaces.includes(namespace)) {
      throw new Error(`Invalid cache namespace: ${namespace}. Use: ${validNamespaces.join(", ")}`);
    }

    const base = `fb:${namespace}:${identifier}`;
    return subResource ? `${base}:${subResource}` : base;
  },
};

/**
 * Cache key validation helpers
 */
export const validateCacheKey = (key: string): boolean => {
  // Must start with fb: prefix
  if (!key.startsWith("fb:")) return false;

  // Must have at least 3 parts (fb:resource:identifier)
  const parts = key.split(":");
  if (parts.length < 3) return false;

  // No empty parts
  if (parts.some((part) => part.length === 0)) return false;

  return true;
};

/**
 * Extract cache key components for debugging/monitoring
 */
export const parseCacheKey = (key: string) => {
  if (!validateCacheKey(key)) {
    throw new Error(`Invalid cache key format: ${key}`);
  }

  const [prefix, resource, identifier, ...subResources] = key.split(":");

  return {
    prefix,
    resource,
    identifier,
    subResource: subResources.length > 0 ? subResources.join(":") : undefined,
    full: key,
  };
};
