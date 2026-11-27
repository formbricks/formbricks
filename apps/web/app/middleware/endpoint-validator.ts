import { isMarketingLinkPath } from "@/modules/settings/lib/marketing-redirects";
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
  // V3 surveys: session cookie or x-api-key (same pattern as management storage)
  if (/^\/api\/v3\/surveys(?:\/|$)/.test(url))
    return { isManagementApi: true, authenticationMethod: AuthenticationMethod.Both };
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

/**
 * Path prefixes that need a signed-in user, as whole path segments. They mirror the authenticated route
 * tree: everything under `app/(app)` that is not public (`/workspaces`, `/organizations`, `/account`,
 * `/attachment-exports`; `/billing-confirmation` is the Stripe return page and stays public), the legacy
 * `app/(redirects)/environments` links and the organization setup step. Add a prefix here when a new
 * top-level authenticated route appears.
 *
 * `request.nextUrl.pathname` never carries `BASE_PATH`, so the list needs no prefix handling for
 * subpath deployments.
 */
const PROTECTED_ROUTE_PREFIXES = [
  "/workspaces",
  "/organizations",
  "/account",
  "/attachment-exports",
  "/environments",
  "/setup/organization",
] as const;

const matchesPathPrefix = (pathname: string, prefix: string): boolean =>
  pathname === prefix || pathname.startsWith(`${prefix}/`);

export const isAuthProtectedRoute = (url: string): boolean => {
  // Next matches routes case-insensitively (`caseSensitiveRoutes` is off), so `/Workspaces/x` reaches the
  // page and must be protected too.
  const pathname = url.toLowerCase();

  // ID-free marketing links (/billing, /contacts, ...) resolve the user's organization, so they need a
  // session too; matched per path segment so /billing-confirmation stays public.
  return (
    PROTECTED_ROUTE_PREFIXES.some((prefix) => matchesPathPrefix(pathname, prefix)) ||
    isMarketingLinkPath(pathname)
  );
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

  // For non-public routes, allow them (includes known admin routes and unknown routes like pipeline)
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
