import { describe, expect, test } from "vitest";
import { getHostFromUrl, getOAuthScopeLabel, isLocalhostHost } from "./oauth-client-metadata";

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

  test("maps known OAuth scopes to localized labels", () => {
    expect(getOAuthScopeLabel("openid", t)).toBe("translated:auth.oauth.scopes.openid");
    expect(getOAuthScopeLabel("profile", t)).toBe("translated:auth.oauth.scopes.profile");
    expect(getOAuthScopeLabel("email", t)).toBe("translated:auth.oauth.scopes.email");
    expect(getOAuthScopeLabel("offline_access", t)).toBe("translated:auth.oauth.scopes.offline_access");
    expect(getOAuthScopeLabel("surveys:read", t)).toBe("translated:auth.oauth.scopes.surveys_read");
    expect(getOAuthScopeLabel("surveys:write", t)).toBe("translated:auth.oauth.scopes.surveys_write");
    expect(getOAuthScopeLabel("workflows:read", t)).toBe("translated:auth.oauth.scopes.workflows_read");
    expect(getOAuthScopeLabel("workflows:write", t)).toBe("translated:auth.oauth.scopes.workflows_write");
  });

  test("keeps unknown OAuth scopes readable", () => {
    expect(getOAuthScopeLabel("custom:scope", t)).toBe("custom:scope");
  });
});
