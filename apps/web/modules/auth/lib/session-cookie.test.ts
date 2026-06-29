import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { getSessionTokenFromCookieHeader, getSessionTokenFromCookieStore } from "./session-cookie";

// Mutable env mock so each test can vary which secret(s) are set.
const { mockEnv } = vi.hoisted(() => ({
  mockEnv: {} as { BETTER_AUTH_SECRET?: string; NEXTAUTH_SECRET?: string },
}));
vi.mock("@/lib/env", () => ({ env: mockEnv }));

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
  mockEnv.BETTER_AUTH_SECRET = undefined;
  mockEnv.NEXTAUTH_SECRET = undefined;
});

describe("Better Auth session-cookie verification", () => {
  const token = "abc123sessioncuid2";
  const BA_SECRET = "better-auth-secret-at-least-32-chars!!";
  const NEXTAUTH = "nextauth-secret-64-chars-or-so-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

  test("verifies a cookie signed with BETTER_AUTH_SECRET", () => {
    mockEnv.BETTER_AUTH_SECRET = BA_SECRET;
    expect(getSessionTokenFromCookieStore(storeWith(BA_COOKIE, sign(token, BA_SECRET)))).toBe(token);
  });

  test("falls back to NEXTAUTH_SECRET when BETTER_AUTH_SECRET is unset (regression: /↔/auth/login loop)", () => {
    // The redirect-loop bug: with BETTER_AUTH_SECRET unset, auth.ts signs cookies with NEXTAUTH_SECRET,
    // so the proxy MUST verify with the same fallback or it rejects every valid session.
    mockEnv.NEXTAUTH_SECRET = NEXTAUTH;
    expect(getSessionTokenFromCookieStore(storeWith(DEV_COOKIE, sign(token, NEXTAUTH)))).toBe(token);
  });

  test("prefers BETTER_AUTH_SECRET over NEXTAUTH_SECRET when both are set", () => {
    mockEnv.BETTER_AUTH_SECRET = BA_SECRET;
    mockEnv.NEXTAUTH_SECRET = NEXTAUTH;
    expect(getSessionTokenFromCookieStore(storeWith(BA_COOKIE, sign(token, BA_SECRET)))).toBe(token);
    // A cookie signed with only the fallback must NOT verify while the primary secret is set.
    expect(getSessionTokenFromCookieStore(storeWith(BA_COOKIE, sign(token, NEXTAUTH)))).toBeNull();
  });

  test("falls through a present-but-invalid cookie to a valid one under another name", () => {
    // Repro of the residual loop: a stale `__Secure-` cookie (signed with an old/default secret) sits
    // alongside a valid non-secure cookie. The proxy checks `__Secure-` first; it must skip the invalid
    // one and accept the valid `formbricks.session_token` rather than wedge the session.
    mockEnv.BETTER_AUTH_SECRET = BA_SECRET;
    const stale = `${token}.${createHmac("sha256", "old-default-secret").update(token).digest("base64")}`;
    const valid = sign(token, BA_SECRET);
    expect(getSessionTokenFromCookieStore(storeWithMany({ [BA_COOKIE]: stale, [DEV_COOKIE]: valid }))).toBe(
      token
    );
  });

  test("fails closed when neither secret is set", () => {
    expect(getSessionTokenFromCookieStore(storeWith(DEV_COOKIE, sign(token, "some-secret")))).toBeNull();
  });

  test("rejects a tampered signature", () => {
    mockEnv.BETTER_AUTH_SECRET = BA_SECRET;
    const tampered = `${token}.${createHmac("sha256", "wrong-secret").update(token).digest("base64")}`;
    expect(getSessionTokenFromCookieStore(storeWith(BA_COOKIE, tampered))).toBeNull();
  });

  test("returns null when no Better Auth session cookie is present", () => {
    mockEnv.BETTER_AUTH_SECRET = BA_SECRET;
    expect(getSessionTokenFromCookieStore(storeWith("unrelated-cookie", "x"))).toBeNull();
  });

  test("reads and verifies from a Cookie header (and null for no header)", () => {
    mockEnv.BETTER_AUTH_SECRET = BA_SECRET;
    const cookie = sign(token, BA_SECRET);
    expect(getSessionTokenFromCookieHeader(`foo=1; ${BA_COOKIE}=${cookie}; bar=2`)).toBe(token);
    expect(getSessionTokenFromCookieHeader(null)).toBeNull();
  });

  test("Cookie header: falls through a present-but-invalid __Secure- cookie to a valid one", () => {
    // Same redirect-loop protection as the cookie-store path (above), but for the raw Cookie header
    // parser: a stale `__Secure-` cookie alongside a valid `formbricks.session_token` must not wedge.
    mockEnv.BETTER_AUTH_SECRET = BA_SECRET;
    const stale = `${token}.${createHmac("sha256", "old-default-secret").update(token).digest("base64")}`;
    const valid = sign(token, BA_SECRET);
    expect(getSessionTokenFromCookieHeader(`${BA_COOKIE}=${stale}; ${DEV_COOKIE}=${valid}`)).toBe(token);
  });
});
