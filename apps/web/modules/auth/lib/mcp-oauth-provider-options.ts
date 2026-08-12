import "server-only";
import type { oauthProvider } from "@better-auth/oauth-provider";
import { MCP_OAUTH_SCOPES, getMcpResourceUrl } from "./oauth-urls";

type TOauthProviderOptions = Parameters<typeof oauthProvider>[0];

/**
 * Options for the Better Auth oauthProvider plugin backing the MCP OAuth flow (ENG-1055).
 * Extracted from auth.ts so integration tests can spin up a throwaway Better Auth instance
 * with the exact production OAuth configuration (DCR + authorize scope semantics) without
 * importing the full auth.ts composition.
 */
export const getMcpOauthProviderOptions = (): TOauthProviderOptions => ({
  loginPage: "/auth/login",
  consentPage: "/account/authorize",
  scopes: [...MCP_OAUTH_SCOPES],
  advertisedMetadata: {
    scopes_supported: [...MCP_OAUTH_SCOPES],
  },
  // Better Auth 1.7 replaced the flat `validAudiences` allow-list with persisted resources
  // (ENG-2343). The difference is the point of the upgrade: 1.6 stamped a token with whatever the
  // client asked for, checked only against this list, so nothing tied the token to what the user
  // actually approved (GHSA-p2fr-6hmx-4528). 1.7 binds the grant instead.
  //
  // `allowedScopes` intersects the requested scopes rather than rejecting them, so it MUST be the
  // full MCP_OAUTH_SCOPES set. Narrowing it to the six resource scopes would silently strip openid,
  // profile, email and offline_access from every token — killing id_tokens and refresh with no error
  // anywhere. Derived from the constant so the two cannot drift.
  //
  // No `accessTokenTtl` on purpose: leaving it unset keeps expiry driven by `accessTokenExpiresIn`
  // and `scopeExpirations` below, preserving the 15-minute write step-up exactly as it works today.
  // A per-resource TTL would be min()'d with those and only muddy the derivation.
  resources: [
    {
      identifier: getMcpResourceUrl(),
      name: "Formbricks MCP",
      allowedScopes: [...MCP_OAUTH_SCOPES],
    },
  ],
  // Boot-time config never overwrites a row an operator edited through the CRUD endpoints. This is
  // the upstream default; pinned explicitly because a silent policy revert on restart would be very
  // hard to attribute.
  resourceSeedMode: "insertOnly",
  // Mandatory, not optional. `enforcePerClientResources` defaults to true, and with no registration
  // resources configured the plugin rejects every explicit resource request — which would break each
  // MCP client the moment it registered.
  clientRegistrationDefaultResources: [getMcpResourceUrl()],
  // `cachedResources` is deliberately NOT set. Its cache is module-scoped with no TTL, invalidated
  // only by CRUD writes in the same process, so on multiple replicas disabling a resource would not
  // take effect until every pod restarted — defeating `disabled` as a revocation lever. It would
  // save one indexed read per /oauth2/token call, which is not the hot path (/api/mcp verifies JWTs
  // locally against a cached JWKS and never reads these tables).
  allowDynamicClientRegistration: true,
  allowUnauthenticatedClientRegistration: true,
  // Register MCP clients with the full advertised scope set by default so the consent screen offers
  // write and the write tools are reachable (clients derive their DCR/authorize scopes from what we
  // advertise, and the plugin validates authorize against the client's registered scopes). Granting
  // write is safe: actual write access is still enforced downstream by the user's workspace
  // permissions. Spread the single source of truth so the defaults can't drift from MCP_OAUTH_SCOPES.
  clientRegistrationDefaultScopes: [...MCP_OAUTH_SCOPES],
  accessTokenExpiresIn: 15 * 60,
  refreshTokenExpiresIn: 30 * 24 * 60 * 60,
  // Every write scope gets the 15-minute step-up expiry, derived from the scope list so a new
  // `<resource>:write` scope inherits it automatically (no separate hand-edit to keep in sync).
  scopeExpirations: Object.fromEntries(
    MCP_OAUTH_SCOPES.filter((scope) => scope.endsWith(":write")).map((scope) => [scope, "15m"])
  ),
  // Store opaque access-token and refresh-token lookup values as hashes. JWT access tokens are
  // stateless and bounded by the short 15-minute lifetime above.
  storeTokens: "hashed",
  prefix: {
    opaqueAccessToken: "fboa_",
    refreshToken: "fbor_",
    clientSecret: "fbocs_",
  },
  customAccessTokenClaims: ({ user }) => ({
    ...(user?.email ? { email: user.email } : {}),
    ...(user?.name ? { name: user.name } : {}),
  }),
  rateLimit: {
    register: { window: 60, max: 5 },
    token: { window: 60, max: 20 },
    introspect: { window: 60, max: 60 },
    revoke: { window: 60, max: 30 },
  },
  // `silenceWarnings` was removed in Better Auth 1.7 (ENG-2343). It acknowledged an
  // `oauthAuthServerConfig` warning: discovery is served by our Next.js catch-all at
  // /.well-known/oauth-authorization-server/api/auth, which Better Auth cannot introspect, so the
  // warning was noise about a verified-correct endpoint rather than a real problem (PR #8447).
  // Nothing replaces it upstream — if 1.7 still emits that warning it is expected and harmless here.
});
