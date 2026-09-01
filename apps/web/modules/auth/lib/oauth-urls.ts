import "server-only";
import { env } from "@/lib/env";

const DEFAULT_WEBAPP_URL = "http://localhost:3000";
const AUTH_BASE_PATH = "/api/auth";
const MCP_RESOURCE_PATH = "/api/mcp";
const MCP_PROTECTED_RESOURCE_METADATA_PATH = "/.well-known/oauth-protected-resource/api/mcp";

const trimTrailingSlash = (value: string): string => value.replace(/\/+$/, "");

const normalizeConfiguredUrl = (value: string | undefined, fallback = DEFAULT_WEBAPP_URL): URL => {
  const configured = value?.trim() || fallback;
  const url = new URL(configured);
  url.hash = "";
  url.search = "";
  url.pathname = trimTrailingSlash(url.pathname);
  return url;
};

const appendPath = (base: URL, path: string): string => {
  const basePath = trimTrailingSlash(base.pathname);
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const alreadyEndsWithPath = basePath === normalizedPath || basePath.endsWith(normalizedPath);
  const pathname = alreadyEndsWithPath ? basePath : `${basePath}${normalizedPath}`;

  return `${base.origin}${pathname}`;
};

const getWebAppBaseUrl = (): URL => normalizeConfiguredUrl(env.WEBAPP_URL, DEFAULT_WEBAPP_URL);

export const getAuthIssuerUrl = (): string => {
  const authBaseUrl = normalizeConfiguredUrl(env.BETTER_AUTH_URL ?? env.NEXTAUTH_URL ?? env.WEBAPP_URL);
  return appendPath(authBaseUrl, AUTH_BASE_PATH);
};

/**
 * Returns the server-side endpoint used only to fetch Better Auth's signing keys.
 *
 * Token issuer validation, OAuth discovery, redirects, cookies, and audiences continue to use the public
 * Auth/WEBAPP URLs. Deployments whose pods cannot resolve or hairpin through that public origin can point this
 * fetch at an internal service without changing the externally visible OAuth contract.
 */
export const getMcpOAuthJwksUrl = (): string => env.MCP_OAUTH_JWKS_URL ?? `${getAuthIssuerUrl()}/jwks`;

export const getMcpResourceUrl = (): string => appendPath(getWebAppBaseUrl(), MCP_RESOURCE_PATH);

export const getMcpProtectedResourceMetadataUrl = (): string =>
  appendPath(getWebAppBaseUrl(), MCP_PROTECTED_RESOURCE_METADATA_PATH);

export const getMcpOrigin = (): string => new URL(getMcpResourceUrl()).origin;

/**
 * The authorization server's own UserInfo endpoint, which is a legitimate second value in an access
 * token's `aud`.
 *
 * The oauth-provider treats UserInfo as an implicit resource: when `openid` is in scope it appends
 * this identifier to the audience alongside the resource the client actually requested. It is the
 * only audience besides the MCP resource URL that a Formbricks-issued MCP token may carry, so the
 * resource server allow-lists exactly these two and rejects anything else (see
 * `hasAcceptedMcpAudience` in modules/mcp/auth.ts).
 *
 * Built off the issuer for the same reason `jwksUrl` is: Better Auth mounts its OAuth endpoints
 * under the auth base path, so the issuer is the prefix the plugin itself uses.
 *
 * The assumption is that this equals Better Auth's own `ctx.context.baseURL`, which is what it stamps
 * into the audience. It holds for both shapes an operator is actually told to configure:
 *
 * - a bare origin — upstream's `withPath` appends `/api/auth`, exactly as `appendPath` does here;
 * - a subpath already ending in `/api/auth` (`https://host/custom-path/api/auth`, which is the literal
 *   value `docs/self-hosting/configuration/custom-subpath.mdx` prescribes) — `withPath` returns it
 *   unchanged because `checkHasPath` is true, and `appendPath` returns it unchanged because its
 *   `basePath.endsWith(normalizedPath)` branch fires.
 *
 * The one shape where they diverge is a configured URL carrying a path that does NOT end in
 * `/api/auth`: `withPath` leaves any non-empty path alone, while `appendPath` would append. Note this
 * is narrower than it used to say here — "any subpath breaks it" is wrong, and the documented subpath
 * is precisely the case that works. Subpath deployments cannot complete a login at all today (ENG-606),
 * so it is still not a live gap.
 *
 * This matters beyond the audience now: `ssoLegacyRedirectUri` in better-auth-providers.ts builds the
 * pinned SSO callback URL from `getAuthIssuerUrl()` (ENG-2343). Because that URL is pinned explicitly,
 * Better Auth sends it on both the authorization and token legs regardless of its own `baseURL`, so a
 * divergence here cannot desynchronise the handshake — it would only mean the URL names a host the
 * operator did not intend, which is a configuration error rather than a protocol one.
 */
export const getOAuthUserInfoUrl = (): string => `${getAuthIssuerUrl()}/oauth2/userinfo`;

export const MCP_OAUTH_SCOPES = [
  "openid",
  "profile",
  "email",
  "offline_access",
  "surveys:read",
  "surveys:write",
  "workflows:read",
  "workflows:write",
  "feedbackRecords:read",
  "feedbackRecords:write",
] as const;

export const MCP_RESOURCE_SCOPES = [
  "surveys:read",
  "surveys:write",
  "workflows:read",
  "workflows:write",
  "feedbackRecords:read",
  "feedbackRecords:write",
] as const;

// Scopes advertised in the RFC 9728 protected-resource metadata. MCP clients derive their
// Dynamic Client Registration + authorize scopes from this list (NOT from the AS metadata),
// and the oauth-provider plugin validates authorize requests against the client's REGISTERED
// scopes — so offline_access (required for refresh tokens) must be advertised here or DCR
// clients can never be granted it. `satisfies` enforces that everything advertised is grantable.
export const MCP_PROTECTED_RESOURCE_SCOPES = [
  ...MCP_RESOURCE_SCOPES,
  "offline_access",
] as const satisfies readonly (typeof MCP_OAUTH_SCOPES)[number][];

/**
 * The `scope` advertised in the 401 `WWW-Authenticate` challenge from the MCP endpoint.
 *
 * A client that hits the 401 *before* fetching the protected-resource metadata uses this string as
 * its Dynamic Client Registration `scope`, then authorizes with the scopes the metadata advertises.
 * The oauth-provider validates an authorize request as a *subset* of the client's registered scopes,
 * so the invariant is that this list must **cover** the metadata list. A narrower challenge means the
 * client registers narrow, authorizes wide, and is rejected with `invalid_scope` — failing its first
 * connect and succeeding only on retry, once the metadata is cached (ENG-2175).
 *
 * Derived from the same array so the two are identical, which satisfies the invariant by construction
 * and leaves nothing to drift.
 */
export const MCP_CHALLENGE_SCOPE = MCP_PROTECTED_RESOURCE_SCOPES.join(" ");
