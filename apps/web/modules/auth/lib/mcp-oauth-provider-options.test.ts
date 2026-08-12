import { describe, expect, test, vi } from "vitest";
import { getMcpOauthProviderOptions } from "./mcp-oauth-provider-options";
import { MCP_OAUTH_SCOPES, getMcpResourceUrl } from "./oauth-urls";

// Env-dependent URL getters resolve from here; scope constants stay real so these assertions cannot
// be satisfied by a fixture agreeing with itself.
vi.mock("@/lib/env", () => ({
  env: {
    WEBAPP_URL: "http://localhost:3000",
    BETTER_AUTH_URL: undefined,
    NEXTAUTH_URL: undefined,
    PUBLIC_URL: undefined,
  },
}));

/**
 * `validAudiences` is the single mitigation standing between this deployment and
 * GHSA-p2fr-6hmx-4528, and until now nothing asserted it.
 *
 * The provider does not bind an access token's `aud` to the resource approved at authorization: it
 * stamps the token with the whole `validAudiences` allow-list. With one entry there is no second
 * audience to escalate into, so the advisory cannot bite here. Add a second entry and it can —
 * silently, with every existing test still green. That is what this suite exists to stop.
 *
 * The resource server enforces the other half (rejecting a token that names an audience beyond this
 * one) in modules/mcp/auth.ts, which is required by RFC 9068 §4 no matter how the provider behaves.
 */
describe("getMcpOauthProviderOptions", () => {
  test("grants exactly one audience, so no token can be minted for a second resource server", () => {
    const { validAudiences } = getMcpOauthProviderOptions();

    expect(validAudiences).toEqual([getMcpResourceUrl()]);
  });

  test("advertises only scopes it is willing to grant", () => {
    const options = getMcpOauthProviderOptions();

    // Registration defaults must stay within the advertised set, or a DCR client is handed a scope
    // /authorize will then refuse.
    expect(options.scopes).toEqual([...MCP_OAUTH_SCOPES]);
    expect(options.clientRegistrationDefaultScopes).toEqual([...MCP_OAUTH_SCOPES]);
    expect(options.advertisedMetadata?.scopes_supported).toEqual([...MCP_OAUTH_SCOPES]);
  });

  test("expires every write scope early, derived from the scope list rather than hand-listed", () => {
    const { scopeExpirations } = getMcpOauthProviderOptions();

    const writeScopes = MCP_OAUTH_SCOPES.filter((scope) => scope.endsWith(":write"));
    expect(writeScopes.length).toBeGreaterThan(0);
    expect(scopeExpirations).toEqual(Object.fromEntries(writeScopes.map((scope) => [scope, "15m"])));
  });
});
