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
    expect(result).toBe("/reset-password/*");
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
    expect(label("https://app.formbricks.com/api/auth/sign-in/passkey")).toBe("/sign-in/*");
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

  test("every emitted label is rooted or the unknown marker, so one Sentry facet stays filterable", () => {
    const labels = [
      "/api/auth/sign-in/email",
      "/api/auth/sign-in/passkey",
      "/api/auth/reset-password",
      `/api/auth/reset-password/${RESET_TOKEN}`,
      "/api/auth/oauth2/token",
      "/api/auth/not-an-endpoint",
    ].map((path) => label(`https://app.formbricks.com${path}`));

    for (const emitted of labels) {
      expect(emitted === UNKNOWN_AUTH_PATH_LABEL || emitted.startsWith("/")).toBe(true);
    }
  });

  test("a trailing slash does not split a known endpoint across two facet values", () => {
    expect(label("https://app.formbricks.com/api/auth/get-session/")).toBe("/get-session");
    expect(label("https://app.formbricks.com/api/auth/sign-in/email//")).toBe("/sign-in/email");
  });

  test("a pathological run of slashes stays linear (no catastrophic backtracking)", () => {
    // Regression guard for the super-linear `replace(/\/+$/, "")` this file used to trim with: the
    // greedy `\/+` was unanchored at the start, so on a slash run not followed by end-of-string the
    // engine retried from every offset — O(N^2) on a value taken straight from the request URL.
    // At this size the old form took ~2.8s locally against ~0.004ms for the reverse scan, so the
    // budget below is a >5x margin over the slowest plausible CI machine and nowhere near the
    // regressed cost.
    const pathological = `https://app.formbricks.com/api/auth/${"/".repeat(100_000)}x`;

    const startedAt = performance.now();
    const result = label(pathological);
    const elapsedMs = performance.now() - startedAt;

    expect(result).toBe(UNKNOWN_AUTH_PATH_LABEL);
    expect(elapsedMs).toBeLessThan(500);
  });

  test("trailing-slash trimming matches the regex it replaced, including the edge shapes", () => {
    // The reverse scan has to be exactly `replace(/\/+$/, "")`: same result on no slashes, one, many,
    // and an all-slash path (where it must not walk past index 0).
    expect(label("https://app.formbricks.com/api/auth/get-session")).toBe("/get-session");
    expect(label("https://app.formbricks.com/api/auth/get-session/")).toBe("/get-session");
    expect(label(`https://app.formbricks.com/api/auth/get-session${"/".repeat(50)}`)).toBe("/get-session");
    // Path reduces to "" — the loop must stop at index 0 rather than underflow.
    expect(label("https://app.formbricks.com/api/auth///")).toBe(UNKNOWN_AUTH_PATH_LABEL);
    expect(label("https://app.formbricks.com/api/auth")).toBe(UNKNOWN_AUTH_PATH_LABEL);
  });

  test("a truncated label never collides with the same-named literal endpoint", () => {
    // `/reset-password` (POST, performs the reset) and `/reset-password/:token` (GET callback) are
    // different endpoints; merging them into one bucket would lose the distinction that matters when
    // reading which one is throwing.
    expect(label("https://app.formbricks.com/api/auth/reset-password")).toBe("/reset-password");
    expect(label(`https://app.formbricks.com/api/auth/reset-password/${RESET_TOKEN}`)).toBe(
      "/reset-password/*"
    );
  });

  test("ignores declared entries that are not usable paths", () => {
    const tolerant = createAuthPathLabeller(["/get-session", "", "no-leading-slash", undefined as never]);

    expect(tolerant("https://app.formbricks.com/api/auth/get-session")).toBe("/get-session");
    expect(tolerant("https://app.formbricks.com/api/auth/no-leading-slash")).toBe(UNKNOWN_AUTH_PATH_LABEL);
  });
});
