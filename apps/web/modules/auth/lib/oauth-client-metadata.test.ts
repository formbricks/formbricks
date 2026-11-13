import { describe, expect, test } from "vitest";
import { getHostFromUrl, isLocalhostHost } from "./oauth-client-metadata";
import { MCP_OAUTH_SCOPES, MCP_PROTECTED_RESOURCE_SCOPES, MCP_RESOURCE_SCOPES } from "./oauth-urls";

describe("OAuth client metadata helpers", () => {
  test("extracts hosts from valid URLs", () => {
    expect(getHostFromUrl("https://client.example.com/callback")).toBe("client.example.com");
    expect(getHostFromUrl("http://localhost:6274/callback")).toBe("localhost:6274");
    expect(getHostFromUrl("not a url")).toBeNull();
    expect(getHostFromUrl(null)).toBeNull();
    expect(getHostFromUrl(undefined)).toBeNull();
  });

  test("matches only exact localhost hosts", () => {
    expect(isLocalhostHost("localhost")).toBe(true);
    expect(isLocalhostHost("localhost:6274")).toBe(true);
    expect(isLocalhostHost("127.0.0.1")).toBe(true);
    expect(isLocalhostHost("127.0.0.1:6274")).toBe(true);
    expect(isLocalhostHost("[::1]")).toBe(true);
    expect(isLocalhostHost("[::1]:6274")).toBe(true);
    expect(isLocalhostHost("localhost.example.com")).toBe(false);
    expect(isLocalhostHost("127.0.0.1.example.com")).toBe(false);
    expect(isLocalhostHost("[::1].example.com")).toBe(false);
    expect(isLocalhostHost(null)).toBe(false);
  });
});

/**
 * Everything advertised must be grantable, and — now that `responses:*` are out — every grantable
 * resource scope is advertised too.
 *
 * Advertising is what makes a client ask: it reads `scopes_supported` from the protected-resource
 * metadata and requests those at `/authorize`, where the plugin validates against the scopes it
 * REGISTERED with. So a scope is published only together with a migration that grants it to clients
 * registered before it existed — for `responses:*`, ENG-2862 (the resource row) and ENG-3470 (the
 * client rows). A grantable-but-unadvertised resource scope is legitimate only as that interim state,
 * and the second test below makes one a deliberate, visible decision rather than an accident.
 */
describe("advertised scopes and grantable scopes agree", () => {
  test("everything advertised is grantable", () => {
    const grantable = new Set<string>(MCP_OAUTH_SCOPES);

    expect(MCP_PROTECTED_RESOURCE_SCOPES.filter((scope) => !grantable.has(scope))).toEqual([]);
  });

  test("every grantable resource scope is advertised", () => {
    // Held back before ENG-3470. If a new scope is ever staged the same way, name it here on purpose
    // — and ship the client-scope migration before removing it again.
    const advertised = new Set<string>(MCP_PROTECTED_RESOURCE_SCOPES);
    const unadvertised = [...MCP_OAUTH_SCOPES].filter(
      (scope) => scope.includes(":") && !advertised.has(scope)
    );

    expect(unadvertised).toEqual([]);
  });

  test("the response scopes are advertised", () => {
    const advertised = new Set<string>(MCP_PROTECTED_RESOURCE_SCOPES);

    expect(advertised.has("responses:read")).toBe(true);
    expect(advertised.has("responses:write")).toBe(true);
  });

  test("audience is read-only: audience:read is advertised and audience:write exists nowhere", () => {
    // ENG-7151: contacts, segments and action classes have only read tools, so a write scope would be a
    // level that does nothing (and a 15-minute write token for no reason).
    expect(MCP_PROTECTED_RESOURCE_SCOPES).toContain("audience:read");
    expect([...MCP_OAUTH_SCOPES, ...MCP_PROTECTED_RESOURCE_SCOPES]).not.toContain("audience:write");
  });

  test("the baseline MCP gate lists exactly the advertised resource scopes", () => {
    // `hasAnyMcpScope(authInfo, MCP_RESOURCE_SCOPES)` is the "at least one resource scope" gate, so a
    // token holding only `responses:*` passes it — which is what makes a responses-only grant usable.
    expect([...MCP_RESOURCE_SCOPES]).toEqual(
      MCP_PROTECTED_RESOURCE_SCOPES.filter((scope) => scope !== "offline_access")
    );
  });
});
