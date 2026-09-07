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
 * The registered resource set is what binds an access token's audience to what the user approved
 * (GHSA-p2fr-6hmx-4528). Better Auth 1.7 replaced the flat `validAudiences` allow-list with this
 * model: a token is issued for a resource the grant covers rather than for whatever the client asked
 * for. Declaring a second resource here would make cross-resource escalation possible again, so the
 * single entry is asserted rather than assumed.
 *
 * The resource server enforces the other half — refusing a token whose `aud` names anything beyond
 * this resource and the AS's own UserInfo endpoint — in modules/mcp/auth.ts. RFC 9068 §4 puts that
 * on the resource server regardless of how the provider behaves, and 1.7 makes it more load-bearing:
 * the provider no longer checks the audience against the *calling* resource server at all.
 */
describe("getMcpOauthProviderOptions", () => {
  // Also pinned in mcp-oauth-dcr.test.ts (#8828). The duplication is deliberate: this is the
  // invariant the whole GHSA-p2fr-6hmx-4528 acceptance rests on, and the two suites can be deleted
  // or rewritten independently. Do not "de-duplicate" this away.
  test("registers exactly one resource, so no token can be minted for a second resource server", () => {
    const { resources } = getMcpOauthProviderOptions();

    expect(resources).toHaveLength(1);
    expect(resources?.[0]).toMatchObject({ identifier: getMcpResourceUrl() });
  });

  // enforcePerClientResources defaults to true, so a DCR client with no linked resource is refused
  // `invalid_target` at the token endpoint — after the user has consented. This must stay in step
  // with the registered resource above.
  test("links every newly registered client to that same resource", () => {
    const { clientRegistrationDefaultResources } = getMcpOauthProviderOptions();

    expect(clientRegistrationDefaultResources).toEqual([getMcpResourceUrl()]);
  });

  // allowedScopes INTERSECTS the requested scopes instead of rejecting them, so a short list would
  // silently strip openid/profile/email/offline_access from every token — no error, no id_token, no
  // refresh. Pinned against the full constant.
  test("allows the full advertised scope set on the resource, not just the resource scopes", () => {
    const { resources } = getMcpOauthProviderOptions();

    expect(resources?.[0]).toMatchObject({ allowedScopes: [...MCP_OAUTH_SCOPES] });
  });

  // Boot-time config must never revert an operator's CRUD edit on restart.
  test("seeds resources insert-only", () => {
    expect(getMcpOauthProviderOptions().resourceSeedMode).toBe("insertOnly");
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
