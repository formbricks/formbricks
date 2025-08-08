import {
  getAllPubliclyAccessibleRoutePatterns,
  getPublicDomainRoutePatterns,
  matchesAnyPattern,
} from "./route-config";

export enum AuthenticationMethod {
  ApiKey = "apiKey",
  Session = "session",
  Both = "both",
  None = "none",
}

export const isClientSideApiRoute = (url: string): { isClientSideApi: boolean; isRateLimited: boolean } => {
  // Open Graph image generation route is a client side API route but it should not be rate limited
  if (url.includes("/api/v1/client/og")) return { isClientSideApi: true, isRateLimited: false };

  const regex = /^\/api\/v\d+\/client\//;
  return { isClientSideApi: regex.test(url), isRateLimited: true };
};

export const isManagementApiRoute = (
  url: string
): { isManagementApi: boolean; authenticationMethod: AuthenticationMethod } => {
  if (url.includes("/api/v1/management/storage"))
    return { isManagementApi: true, authenticationMethod: AuthenticationMethod.Both };
  if (url.includes("/api/v1/webhooks"))
    return { isManagementApi: true, authenticationMethod: AuthenticationMethod.ApiKey };

  const regex = /^\/api\/v\d+\/management\//;
  return { isManagementApi: regex.test(url), authenticationMethod: AuthenticationMethod.ApiKey };
};

export const isIntegrationRoute = (url: string): boolean => {
  const regex = /^\/api\/v\d+\/integrations\//;
  return regex.test(url);
};

export const isAuthProtectedRoute = (url: string): boolean => {
  // List of routes that require authentication
  const protectedRoutes = ["/environments", "/setup/organization", "/organizations"];

  return protectedRoutes.some((route) => url.startsWith(route));
};

export const isSyncWithUserIdentificationEndpoint = (
  url: string
): { environmentId: string; userId: string } | false => {
  const regex = /\/api\/v1\/client\/(?<environmentId>[^/]+)\/app\/sync\/(?<userId>[^/]+)/;
  const match = url.match(regex);
  return match ? { environmentId: match.groups!.environmentId, userId: match.groups!.userId } : false;
};

/**
 * Check if the route should be accessible on the public domain (PUBLIC_URL)
 * Uses whitelist approach - only explicitly allowed routes are accessible
 */
export const isPublicDomainRoute = (url: string): boolean => {
  const publicRoutePatterns = getAllPubliclyAccessibleRoutePatterns();
  return matchesAnyPattern(url, publicRoutePatterns);
};

/**
 * Check if the route should be accessible on the admin domain (WEBAPP_URL)
 * When PUBLIC_URL is configured, admin domain should only allow admin-specific routes + health
 */
export const isAdminDomainRoute = (url: string): boolean => {
  const publicOnlyRoutePatterns = getPublicDomainRoutePatterns();
  const isPublicRoute = matchesAnyPattern(url, publicOnlyRoutePatterns);

  if (isPublicRoute) {
    return false;
  }

  // For non-public routes, allow them (includes known admin routes and unknown routes like pipeline, cron)
  return true;
};

/**
 * Determine if a request should be allowed based on domain and route
 */
export const isRouteAllowedForDomain = (url: string, isPublicDomain: boolean): boolean => {
  if (isPublicDomain) {
    return isPublicDomainRoute(url);
  }

  return isAdminDomainRoute(url);
};
