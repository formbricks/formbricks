/**
 * Routes that should be accessible on the public domain (PUBLIC_URL)
 * Uses whitelist approach - only these routes are allowed on public domain
 */
const PUBLIC_ROUTES = {
  // Survey routes
  SURVEY_ROUTES: [
    /^\/s\/[^/]+/, // /s/[surveyId] - survey pages
    /^\/c\/[^/]+/, // /c/[jwt] - contact survey pages
  ],

  // API routes accessible from public domain
  API_ROUTES: [
    /^\/api\/v[12]\/client\//, // /api/v1/client/** and /api/v2/client/**
  ],

  // Share routes
  SHARE_ROUTES: [
    /^\/share\//, // /share/** - shared survey results
  ],
} as const;

const COMMON_ROUTES = {
  HEALTH_ROUTES: [/^\/health$/], // /health endpoint
} as const;

/**
 * Get public only route patterns as a flat array
 */
export const getPublicOnlyRoutePatterns = (): RegExp[] => {
  return Object.values(PUBLIC_ROUTES).flat();
};

/**
 * Get all public route patterns as a flat array
 */
export const getAllPublicRoutePatterns = (): RegExp[] => {
  const routes = {
    ...PUBLIC_ROUTES,
    ...COMMON_ROUTES,
  };

  return Object.values(routes).flat();
};

/**
 * Check if a URL matches any of the given route patterns
 */
export const matchesAnyPattern = (url: string, patterns: RegExp[]): boolean => {
  return patterns.some((pattern) => pattern.test(url));
};
