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
  validAudiences: [getMcpResourceUrl()],
  allowDynamicClientRegistration: true,
  allowUnauthenticatedClientRegistration: true,
  // Register MCP clients with read + write by default so the consent screen offers write and the
  // write tools are reachable (clients derive their DCR/authorize scopes from what we advertise, and
  // the plugin validates authorize against the client's registered scopes). Granting the write scope
  // is safe: actual write access is still enforced downstream by the user's workspace permissions.
  clientRegistrationDefaultScopes: [
    "openid",
    "profile",
    "email",
    "offline_access",
    "surveys:read",
    "surveys:write",
    "workflows:read",
    "workflows:write",
  ],
  accessTokenExpiresIn: 15 * 60,
  refreshTokenExpiresIn: 30 * 24 * 60 * 60,
  scopeExpirations: {
    "surveys:write": "15m",
    "workflows:write": "15m",
  },
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
  // Discovery is served by our Next.js catch-all at /.well-known/oauth-authorization-server/api/auth;
  // Better Auth can't introspect the route, so this acks the (verified-correct) endpoint rather than
  // masking a real problem. See PR #8447.
  silenceWarnings: {
    oauthAuthServerConfig: true,
  },
});
