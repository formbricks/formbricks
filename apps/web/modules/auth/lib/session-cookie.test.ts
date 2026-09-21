import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { getSessionTokenFromCookieHeader, getSessionTokenFromCookieStore } from "./session-cookie";

// Mutable constants mock so each test can vary whether a secret is resolved. `AUTH_SECRET` is the
// already-resolved BETTER_AUTH_SECRET/NEXTAUTH_SECRET value — which of the two wins is constants.ts's
// business and is covered by lib/constants.test.ts. Mocking the raw env vars here would no longer
// steer this module at all.
// ENCRYPTION_KEY is reached transitively: lib/crypto.ts (constantTimeEqual) reads it at module load.
const { mockConstants } = vi.hoisted(() => ({
  mockConstants: { ENCRYPTION_KEY: "0".repeat(64) } as {
    AUTH_SECRET?: string;
    ENCRYPTION_KEY: string;
  },
}));
vi.mock("@/lib/constants", () => mockConstants);

const BA_COOKIE = "__Secure-formbricks.session_token";
const DEV_COOKIE = "formbricks.session_token";

// Mirror better-call's serializeSignedCookie: `${token}.${base64(HMAC-SHA256(token, secret))}`.
const sign = (token: string, secret: string): string =>
  `${token}.${createHmac("sha256", secret).update(token).digest("base64")}`;

const storeWith = (name: string, value: string) => ({
  get: (n: string) => (n === name ? { value } : undefined),
});

const storeWithMany = (cookies: Record<string, string>) => ({
  get: (n: string) => (n in cookies ? { value: cookies[n] } : undefined),
});

beforeEach(() => {
  mockConstants.AUTH_SECRET = undefined;
});

describe("Better Auth session-cookie verification", () => {
  const token = "abc123sessioncuid2";
  const BA_SECRET = "better-auth-secret-at-least-32-chars!!";
  const OTHER_SECRET = "some-other-secret-64-chars-or-so-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

  test("verifies a cookie signed with the resolved auth secret", () => {
    mockConstants.AUTH_SECRET = BA_SECRET;
    expect(getSessionTokenFromCookieStore(storeWith(BA_COOKIE, sign(token, BA_SECRET)))).toBe(token);
  });

  test("rejects a cookie signed with any other secret (regression: /↔/auth/login loop)", () => {
    // The redirect-loop bug in its general form: if this module ever verifies with a secret other than
    // the one auth.ts signs with, it rejects every valid session and bounces the user between / and
    // /auth/login. Both sides now read the same resolved constant, so the only way they can diverge is
    // if one of them stops doing so.
    mockConstants.AUTH_SECRET = BA_SECRET;
    expect(getSessionTokenFromCookieStore(storeWith(BA_COOKIE, sign(token, OTHER_SECRET)))).toBeNull();
  });

  test("falls through a present-but-invalid cookie to a valid one under another name", () => {
    // Repro of the residual loop: a stale `__Secure-` cookie (signed with an old/default secret) sits
    // alongside a valid non-secure cookie. The proxy checks `__Secure-` first; it must skip the invalid
    // one and accept the valid `formbricks.session_token` rather than wedge the session.
    mockConstants.AUTH_SECRET = BA_SECRET;
    const stale = `${token}.${createHmac("sha256", "old-default-secret").update(token).digest("base64")}`;
    const valid = sign(token, BA_SECRET);
    expect(getSessionTokenFromCookieStore(storeWithMany({ [BA_COOKIE]: stale, [DEV_COOKIE]: valid }))).toBe(
      token
    );
  });

  test("fails closed when no secret is set", () => {
    expect(getSessionTokenFromCookieStore(storeWith(DEV_COOKIE, sign(token, "some-secret")))).toBeNull();
  });

  test("rejects a tampered signature", () => {
    mockConstants.AUTH_SECRET = BA_SECRET;
    const tampered = `${token}.${createHmac("sha256", "wrong-secret").update(token).digest("base64")}`;
    expect(getSessionTokenFromCookieStore(storeWith(BA_COOKIE, tampered))).toBeNull();
  });

  test("returns null when no Better Auth session cookie is present", () => {
    mockConstants.AUTH_SECRET = BA_SECRET;
    expect(getSessionTokenFromCookieStore(storeWith("unrelated-cookie", "x"))).toBeNull();
  });

  test("reads and verifies from a Cookie header (and null for no header)", () => {
    mockConstants.AUTH_SECRET = BA_SECRET;
    const cookie = sign(token, BA_SECRET);
    expect(getSessionTokenFromCookieHeader(`foo=1; ${BA_COOKIE}=${cookie}; bar=2`)).toBe(token);
    expect(getSessionTokenFromCookieHeader(null)).toBeNull();
  });

  test("Cookie header: falls through a present-but-invalid __Secure- cookie to a valid one", () => {
    // Same redirect-loop protection as the cookie-store path (above), but for the raw Cookie header
    // parser: a stale `__Secure-` cookie alongside a valid `formbricks.session_token` must not wedge.
    mockConstants.AUTH_SECRET = BA_SECRET;
    const stale = `${token}.${createHmac("sha256", "old-default-secret").update(token).digest("base64")}`;
    const valid = sign(token, BA_SECRET);
    expect(getSessionTokenFromCookieHeader(`${BA_COOKIE}=${stale}; ${DEV_COOKIE}=${valid}`)).toBe(token);
  });
});
