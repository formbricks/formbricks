export type TEnvoyRateLimitAuthType = "none" | "apiKey" | "session";

type TEnvoyRateLimitRequest = {
  pathname: string;
  method: string;
  authType: TEnvoyRateLimitAuthType;
};

const V1_CLIENT_STORAGE_PATTERN = /^\/api\/v1\/client\/[^/]+\/storage$/;
const V1_CLIENT_ENVIRONMENT_PATTERN = /^\/api\/v1\/client\/[^/]+\/environment$/;
const V1_CLIENT_RESPONSES_PATTERN = /^\/api\/v1\/client\/[^/]+\/responses$/;
const V1_CLIENT_RESPONSE_PATTERN = /^\/api\/v1\/client\/[^/]+\/responses\/[^/]+$/;
const V1_CLIENT_DISPLAYS_PATTERN = /^\/api\/v1\/client\/[^/]+\/displays$/;
const V1_CLIENT_USER_PATTERN = /^\/api\/v1\/client\/[^/]+\/user$/;
const V2_CLIENT_RESPONSES_PATTERN = /^\/api\/v2\/client\/[^/]+\/responses$/;
const V2_CLIENT_RESPONSE_PATTERN = /^\/api\/v2\/client\/[^/]+\/responses\/[^/]+$/;
const V2_CLIENT_DISPLAYS_PATTERN = /^\/api\/v2\/client\/[^/]+\/displays$/;
const V2_CLIENT_STORAGE_PATTERN = /^\/api\/v2\/client\/[^/]+\/storage$/;
const STORAGE_DELETE_PATTERN = /^\/storage\/[^/]+\/(public|private)\/.+$/;

const V1_MANAGEMENT_PREFIX = "/api/v1/management/";
const V1_WEBHOOKS_PREFIX = "/api/v1/webhooks/";

const V1_GENERAL_METHODS = new Set(["GET", "POST", "PUT", "PATCH", "DELETE"]);
const normalizeMethod = (method: string): string => method.toUpperCase();

const matchesPrefixedPath = (pathname: string, prefix: string): boolean => pathname.startsWith(prefix);

/**
 * Mirrors the live Envoy rate-limit policy set.
 * Keep this matcher aligned with the Gateway policies when coverage changes.
 */
export const isRouteRateLimitedByEnvoy = ({
  pathname,
  method,
  authType,
}: TEnvoyRateLimitRequest): boolean => {
  const normalizedMethod = normalizeMethod(method);

  if (normalizedMethod === "OPTIONS") {
    return false;
  }

  if (authType === "none" && normalizedMethod === "POST" && pathname === "/api/auth/callback/credentials") {
    return true;
  }

  if (authType === "none" && normalizedMethod === "POST" && pathname === "/api/auth/callback/token") {
    return true;
  }

  if (
    authType === "apiKey" &&
    V1_GENERAL_METHODS.has(normalizedMethod) &&
    matchesPrefixedPath(pathname, V1_MANAGEMENT_PREFIX)
  ) {
    return true;
  }

  if (
    authType === "apiKey" &&
    V1_GENERAL_METHODS.has(normalizedMethod) &&
    matchesPrefixedPath(pathname, V1_WEBHOOKS_PREFIX)
  ) {
    return true;
  }

  if (authType === "apiKey" && normalizedMethod === "DELETE" && STORAGE_DELETE_PATTERN.test(pathname)) {
    return true;
  }

  if (authType !== "none") {
    return false;
  }

  if (normalizedMethod === "POST" && V1_CLIENT_STORAGE_PATTERN.test(pathname)) {
    return true;
  }

  if (normalizedMethod === "GET" && V1_CLIENT_ENVIRONMENT_PATTERN.test(pathname)) {
    return true;
  }

  if (normalizedMethod === "POST" && V1_CLIENT_RESPONSES_PATTERN.test(pathname)) {
    return true;
  }

  if (normalizedMethod === "PUT" && V1_CLIENT_RESPONSE_PATTERN.test(pathname)) {
    return true;
  }

  if (normalizedMethod === "POST" && V1_CLIENT_DISPLAYS_PATTERN.test(pathname)) {
    return true;
  }

  if (normalizedMethod === "POST" && V1_CLIENT_USER_PATTERN.test(pathname)) {
    return true;
  }

  if (normalizedMethod === "POST" && V2_CLIENT_RESPONSES_PATTERN.test(pathname)) {
    return true;
  }

  if (normalizedMethod === "PUT" && V2_CLIENT_RESPONSE_PATTERN.test(pathname)) {
    return true;
  }

  if (normalizedMethod === "POST" && V2_CLIENT_DISPLAYS_PATTERN.test(pathname)) {
    return true;
  }

  if (normalizedMethod === "POST" && V2_CLIENT_STORAGE_PATTERN.test(pathname)) {
    return true;
  }

  return false;
};
