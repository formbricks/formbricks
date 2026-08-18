import { describe, expect, test } from "vitest";
import { UNKNOWN_AUTH_PATH_LABEL, createAuthPathLabeller } from "./better-auth-path-label";

// Mirrors the real registry's shape: literal endpoints plus the four routes better-auth@1.6.23
// declares with a path parameter. `/reset-password/:token` is the dangerous one — its parameter is a
// live password-reset token.
const DECLARED_PATHS = [
  "/get-session",
  "/sign-in/email",
  "/sign-up/email",
  "/two-factor/verify-totp",
  "/request-password-reset",
  "/reset-password",
  "/reset-password/:token",
  "/callback/:id",
  "/oauth2/authorize",
  "/oauth2/token",
  "/oauth2/userinfo",
  "/oauth2/callback/:providerId",
  "/oauth2/client/:id",
];

const label = createAuthPathLabeller(DECLARED_PATHS);

// Shaped like a real reset token — 32 lowercase alphanumerics — so no character-class heuristic could
// tell it apart from a literal path segment; only the exact-match rule can. Deliberately repetitive
// and low-entropy so secret scanners don't flag the fixture itself.
const RESET_TOKEN = "faketokenfaketokenfaketoken00001";

describe("createAuthPathLabeller — the security invariant (ENG-2259)", () => {
  test("never emits the token from /reset-password/:token", () => {
    const result = label(`https://app.formbricks.com/api/auth/reset-password/${RESET_TOKEN}`);

    // The endpoint is still named — only the secret in it is dropped.
    expect(result).toBe("reset-password");
    expect(result).not.toContain(RESET_TOKEN);
  });

  test("never emits the parameter of ANY declared parameterized route", () => {
    // The general form of the case above: whatever better-auth declares with a `:param` today or after
    // an upgrade, a concrete request for it cannot exact-match the pattern, so it degrades. This is the
    // property that makes the labeller safe without a hand-maintained list of sensitive paths.
    const parameterized = DECLARED_PATHS.filter((path) => path.includes(":"));
    expect(parameterized.length).toBeGreaterThan(0);

    for (const pattern of parameterized) {
      const concrete = pattern.replace(/:[^/]+/g, RESET_TOKEN);
      expect(label(`https://app.formbricks.com/api/auth${concrete}`)).not.toContain(RESET_TOKEN);
    }
  });

  test("drops the query string, which carries OAuth codes and verification tokens", () => {
    const result = label(`https://app.formbricks.com/api/auth/oauth2/token?code=${RESET_TOKEN}&state=abc123`);

    expect(result).toBe("/oauth2/token");
    expect(result).not.toContain(RESET_TOKEN);
    expect(result).not.toContain("abc123");
  });
});

describe("createAuthPathLabeller — labelling rules", () => {
  test("emits a parameter-free declared path whole", () => {
    expect(label("https://app.formbricks.com/api/auth/sign-in/email")).toBe("/sign-in/email");
    expect(label("https://app.formbricks.com/api/auth/get-session")).toBe("/get-session");
  });

  test("keeps the oauth2 endpoints distinct, which is what the MCP-OAuth lead needs", () => {
    const labels = ["/oauth2/token", "/oauth2/userinfo", "/oauth2/authorize"].map((path) =>
      label(`https://app.formbricks.com/api/auth${path}`)
    );

    expect(labels).toEqual(["/oauth2/token", "/oauth2/userinfo", "/oauth2/authorize"]);
  });

  test("falls back to the first segment for an undeclared deeper path", () => {
    expect(label("https://app.formbricks.com/api/auth/sign-in/passkey")).toBe("sign-in");
  });

  test("labels an unrecognized first segment unknown, bounding tag cardinality", () => {
    expect(label("https://app.formbricks.com/api/auth/not-an-endpoint")).toBe(UNKNOWN_AUTH_PATH_LABEL);
    expect(label("https://app.formbricks.com/api/auth/%2e%2e/etc/passwd")).toBe(UNKNOWN_AUTH_PATH_LABEL);
  });

  test("resolves the path when the app is served from a Next.js basePath subpath", () => {
    expect(label("https://example.com/formbricks/api/auth/sign-in/email")).toBe("/sign-in/email");
  });

  test("labels a URL outside the auth base path, or an unparseable one, unknown", () => {
    expect(label("https://app.formbricks.com/api/v1/surveys")).toBe(UNKNOWN_AUTH_PATH_LABEL);
    expect(label("not-a-url")).toBe(UNKNOWN_AUTH_PATH_LABEL);
  });

  test("ignores declared entries that are not usable paths", () => {
    const tolerant = createAuthPathLabeller(["/get-session", "", "no-leading-slash", undefined as never]);

    expect(tolerant("https://app.formbricks.com/api/auth/get-session")).toBe("/get-session");
    expect(tolerant("https://app.formbricks.com/api/auth/no-leading-slash")).toBe(UNKNOWN_AUTH_PATH_LABEL);
  });
});
