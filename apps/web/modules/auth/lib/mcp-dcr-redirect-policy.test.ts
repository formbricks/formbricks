import { describe, expect, test } from "vitest";
import { findDisallowedRedirectUri, isLoopbackRedirectUri } from "./mcp-dcr-redirect-policy";

/**
 * ENG-3086. The redirect-URI allowlist that closes the open DCR consent-phishing hole: an anonymous
 * registration may only claim `http` loopback redirect URIs (RFC 8252 §7.3), the one form a remote
 * attacker cannot receive an authorization code at. Everything else — arbitrary `https` web URIs,
 * routable `http`, private-use reverse-domain schemes — is rejected.
 */
describe("isLoopbackRedirectUri (ENG-3086)", () => {
  test.each(["http://localhost:8080/cb", "http://127.0.0.1:1/cb", "http://[::1]:9000/cb"])(
    "accepts %s",
    (uri) => {
      expect(isLoopbackRedirectUri(uri)).toBe(true);
    }
  );

  test.each([
    "https://localhost:8080/cb",
    "https://example.com/cb1",
    "https://attacker-controlled-test.example.org/cb",
    "http://evil.example.com/cb",
    "com.example.app:/callback",
    "file:///tmp/cb",
    "not a url",
    null,
    42,
  ])("rejects %s", (uri) => {
    expect(isLoopbackRedirectUri(uri)).toBe(false);
  });
});

describe("findDisallowedRedirectUri (ENG-3086)", () => {
  test("returns null for an all-loopback registration", () => {
    expect(
      findDisallowedRedirectUri(JSON.stringify({ redirect_uris: ["http://127.0.0.1:33418/callback"] }))
    ).toBeNull();
  });

  test("flags a non-loopback redirect_uri", () => {
    expect(
      findDisallowedRedirectUri(JSON.stringify({ redirect_uris: ["https://evil.example.com/cb"] }))
    ).toEqual({ field: "redirect_uris", uri: "https://evil.example.com/cb" });
  });

  test("flags a non-loopback post_logout_redirect_uri", () => {
    expect(
      findDisallowedRedirectUri(
        JSON.stringify({ post_logout_redirect_uris: ["https://evil.example.com/logout"] })
      )
    ).toEqual({ field: "post_logout_redirect_uris", uri: "https://evil.example.com/logout" });
  });

  test("flags a non-loopback URI even when a loopback one is also present", () => {
    expect(
      findDisallowedRedirectUri(
        JSON.stringify({ redirect_uris: ["http://127.0.0.1:1/cb", "http://evil.example.com/cb"] })
      )
    ).toEqual({ field: "redirect_uris", uri: "http://evil.example.com/cb" });
  });

  test("returns null for a body without redirect URIs", () => {
    expect(findDisallowedRedirectUri(JSON.stringify({ client_name: "x" }))).toBeNull();
  });

  // A malformed body must reach upstream unchanged and produce upstream's own error, not ours.
  test.each(["not json", "[1,2,3]", "null", '"a string"'])("returns null for malformed body %s", (body) => {
    expect(findDisallowedRedirectUri(body)).toBeNull();
  });
});
