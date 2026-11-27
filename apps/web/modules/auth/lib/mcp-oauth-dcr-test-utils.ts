import { oauthProvider } from "@better-auth/oauth-provider";
import { betterAuth } from "better-auth";
import { memoryAdapter } from "better-auth/adapters/memory";
import { jwt } from "better-auth/plugins";
import { prepareDcrRequest } from "./mcp-dcr-application-type";
import { getMcpOauthProviderOptions } from "./mcp-oauth-provider-options";
import { getAuthIssuerUrl, getMcpResourceUrl } from "./oauth-urls";

/*
 * A real Better Auth instance with the production oauth-provider options, shared by the DCR suites.
 * Each suite mocks `@/lib/env` and `./mcp-grant-token-claim` itself: `vi.mock` is per test file.
 */

export const BASE_URL = "http://localhost:3000";
export const REDIRECT_URI = "http://127.0.0.1:33418/callback";

/**
 * A registration exactly as an MCP client sends it: a loopback callback and no `application_type`.
 * Shared by the suites that read it from opposite ends — one asks what upstream does with it, the
 * other that our own gate lets it through untouched.
 */
export const LOOPBACK_REGISTRATION = JSON.stringify({
  client_name: "MCP DCR client that omits application_type",
  redirect_uris: [REDIRECT_URI],
  grant_types: ["authorization_code", "refresh_token"],
  response_types: ["code"],
  token_endpoint_auth_method: "none",
  scope: "surveys:read",
});

/** An in-memory Better Auth with the production oauth-provider plugin. */
export const createAuthInstance = ({ withEmailPassword = false }: { withEmailPassword?: boolean } = {}) => {
  // memoryAdapter needs every model it will touch declared up front — it does not create them
  // lazily. Better Auth 1.7 added the resource tables, and without them the plugin's boot-time
  // resource seeding logs `Model oauthResource not found in the DB` and every authorize fails.
  const db: Record<string, unknown[]> = {
    user: [],
    session: [],
    account: [],
    verification: [],
    jwks: [],
    oauthClient: [],
    oauthAccessToken: [],
    oauthRefreshToken: [],
    oauthConsent: [],
    oauthResource: [],
    oauthClientResource: [],
    oauthClientAssertion: [],
  };
  return betterAuth({
    baseURL: BASE_URL,
    secret: "mcp-oauth-dcr-test-secret",
    database: memoryAdapter(db),
    // Only the end-to-end flow below needs a signed-in user; everything else stops at the login redirect.
    ...(withEmailPassword ? { emailAndPassword: { enabled: true } } : {}),
    // jwt is a hard dependency of oauthProvider; configured as in production auth.ts.
    plugins: [
      jwt({
        disableSettingJwtHeader: true,
        jwt: { issuer: getAuthIssuerUrl(), audience: getMcpResourceUrl() },
      }),
      oauthProvider(getMcpOauthProviderOptions()),
    ],
  });
};

export const REGISTER_PATH = "/api/auth/oauth2/register";

export const registrationRequest = (path: string, body: string, contentType = "application/json") =>
  new Request(`${BASE_URL}${path}`, {
    method: "POST",
    headers: { "content-type": contentType },
    body,
  });

/** The route's real pipeline: the gate first, then Better Auth for whatever it lets through. */
export const throughRoute = async (auth: ReturnType<typeof createAuthInstance>, request: Request) => {
  const prepared = await prepareDcrRequest(request);
  return prepared instanceof Response ? prepared : auth.handler(prepared);
};
