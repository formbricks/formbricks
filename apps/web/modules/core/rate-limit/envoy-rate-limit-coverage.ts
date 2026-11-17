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

type TEnvoyRateLimitRule = {
  /** Upper-case methods the policy covers. */
  methods: ReadonlySet<string>;
  matches: (pathname: string) => boolean;
};

const rule = (methods: string | ReadonlySet<string>, matches: (pathname: string) => boolean) => ({
  methods: typeof methods === "string" ? new Set([methods]) : methods,
  matches,
});
const exactPath = (path: string) => (pathname: string) => pathname === path;
const prefixedPath = (prefix: string) => (pathname: string) => matchesPrefixedPath(pathname, prefix);
const patternPath = (pattern: RegExp) => (pathname: string) => pattern.test(pathname);

/** The policies per auth type; a session-authenticated request is not rate limited by Envoy. */
const ENVOY_RATE_LIMIT_RULES: Record<TEnvoyRateLimitAuthType, TEnvoyRateLimitRule[]> = {
  none: [
    rule("POST", exactPath("/api/auth/callback/credentials")),
    rule("POST", exactPath("/api/auth/callback/token")),
    rule("POST", patternPath(V1_CLIENT_STORAGE_PATTERN)),
    rule("GET", patternPath(V1_CLIENT_ENVIRONMENT_PATTERN)),
    rule("POST", patternPath(V1_CLIENT_RESPONSES_PATTERN)),
    rule("PUT", patternPath(V1_CLIENT_RESPONSE_PATTERN)),
    rule("POST", patternPath(V1_CLIENT_DISPLAYS_PATTERN)),
    rule("POST", patternPath(V1_CLIENT_USER_PATTERN)),
    rule("POST", patternPath(V2_CLIENT_RESPONSES_PATTERN)),
    rule("PUT", patternPath(V2_CLIENT_RESPONSE_PATTERN)),
    rule("POST", patternPath(V2_CLIENT_DISPLAYS_PATTERN)),
    rule("POST", patternPath(V2_CLIENT_STORAGE_PATTERN)),
  ],
  apiKey: [
    rule(V1_GENERAL_METHODS, prefixedPath(V1_MANAGEMENT_PREFIX)),
    rule(V1_GENERAL_METHODS, prefixedPath(V1_WEBHOOKS_PREFIX)),
    rule("DELETE", patternPath(STORAGE_DELETE_PATTERN)),
  ],
  session: [],
};

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

  if (!Object.hasOwn(ENVOY_RATE_LIMIT_RULES, authType)) return false;

  return ENVOY_RATE_LIMIT_RULES[authType].some(
    ({ methods, matches }) => methods.has(normalizedMethod) && matches(pathname)
  );
};
