import { describe, expect, test } from "vitest";
import enUS from "@/locales/en-US.json";
import { getHostFromUrl, getOAuthScopeLabel, isLocalhostHost } from "./oauth-client-metadata";
import { MCP_OAUTH_SCOPES, MCP_PROTECTED_RESOURCE_SCOPES, MCP_RESOURCE_SCOPES } from "./oauth-urls";

const t = (key: string) => `translated:${key}`;

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

  // Derived from MCP_OAUTH_SCOPES rather than listed by hand: the hand-written enumeration below used
  // to be the only check, so adding a scope without a label left `getOAuthScopeLabel` falling through
  // to `default: return scope` and the consent screen showing a raw `responses:write` — with every test
  // still green. Proven by adding the two ENG-2862 scopes and watching nothing fail.
  test("gives every grantable scope a label, and every label a translation", () => {
    const missingLabel = MCP_OAUTH_SCOPES.filter((scope) => getOAuthScopeLabel(scope, t) === scope);
    expect(missingLabel).toEqual([]);

    // The key has to exist in en-US too, or the label is the key rendered verbatim.
    const missingTranslation = MCP_OAUTH_SCOPES.map((scope) => getOAuthScopeLabel(scope, t))
      .map((label) => label.replace("translated:auth.oauth.scopes.", ""))
      .filter((key) => !(key in enUS.auth.oauth.scopes));
    expect(missingTranslation).toEqual([]);
  });

  test("maps known OAuth scopes to localized labels", () => {
    expect(getOAuthScopeLabel("openid", t)).toBe("translated:auth.oauth.scopes.openid");
    expect(getOAuthScopeLabel("profile", t)).toBe("translated:auth.oauth.scopes.profile");
    expect(getOAuthScopeLabel("email", t)).toBe("translated:auth.oauth.scopes.email");
    expect(getOAuthScopeLabel("offline_access", t)).toBe("translated:auth.oauth.scopes.offline_access");
    expect(getOAuthScopeLabel("surveys:read", t)).toBe("translated:auth.oauth.scopes.surveys_read");
    expect(getOAuthScopeLabel("surveys:write", t)).toBe("translated:auth.oauth.scopes.surveys_write");
    expect(getOAuthScopeLabel("workflows:read", t)).toBe("translated:auth.oauth.scopes.workflows_read");
    expect(getOAuthScopeLabel("workflows:write", t)).toBe("translated:auth.oauth.scopes.workflows_write");
    expect(getOAuthScopeLabel("feedbackRecords:read", t)).toBe(
      "translated:auth.oauth.scopes.feedback_records_read"
    );
    expect(getOAuthScopeLabel("feedbackRecords:write", t)).toBe(
      "translated:auth.oauth.scopes.feedback_records_write"
    );
    expect(getOAuthScopeLabel("responses:read", t)).toBe("translated:auth.oauth.scopes.responses_read");
    expect(getOAuthScopeLabel("responses:write", t)).toBe("translated:auth.oauth.scopes.responses_write");
  });

  test("keeps unknown OAuth scopes readable", () => {
    expect(getOAuthScopeLabel("custom:scope", t)).toBe("custom:scope");
  });
});

/**
 * A scope can be grantable without being advertised, and the two lists must be allowed to differ —
 * but only in that direction, and only on purpose.
 *
 * Advertising is what makes a client ask: it reads `scopes_supported` from the protected-resource
 * metadata and requests those at `/authorize`, where the plugin validates against the scopes it
 * REGISTERED with. So publishing a scope to clients that registered before it existed earns them
 * `invalid_scope` on their next consent. That is why `responses:*` ship grantable but unadvertised
 * (ENG-2862) and are published only when the tools behind them land (ENG-2852).
 */
describe("advertised scopes are a deliberate subset of grantable scopes", () => {
  test("everything advertised is grantable", () => {
    const grantable = new Set<string>(MCP_OAUTH_SCOPES);

    expect(MCP_PROTECTED_RESOURCE_SCOPES.filter((scope) => !grantable.has(scope))).toEqual([]);
  });

  test("the responses scopes are grantable but not yet advertised", () => {
    const grantable = new Set<string>(MCP_OAUTH_SCOPES);
    const advertised = new Set<string>(MCP_PROTECTED_RESOURCE_SCOPES);

    for (const scope of ["responses:read", "responses:write"]) {
      expect(grantable.has(scope)).toBe(true);
      expect(advertised.has(scope)).toBe(false);
    }
  });

  test("every other resource scope IS advertised, so this stays a one-off rather than a habit", () => {
    const advertised = new Set<string>(MCP_PROTECTED_RESOURCE_SCOPES);
    const unadvertised = [...MCP_OAUTH_SCOPES].filter(
      (scope) => scope.includes(":") && !advertised.has(scope)
    );

    expect(unadvertised).toEqual(["responses:read", "responses:write"]);
  });

  test("the baseline MCP gate lists exactly the advertised resource scopes", () => {
    // `hasAnyMcpScope(authInfo, MCP_RESOURCE_SCOPES)` is the "at least one resource scope" gate. A
    // token holding only an unadvertised scope would fail it — fine while none can be issued, and the
    // reason turning `responses:*` on means adding it here too.
    expect([...MCP_RESOURCE_SCOPES]).toEqual(
      MCP_PROTECTED_RESOURCE_SCOPES.filter((scope) => scope !== "offline_access")
    );
  });
});
