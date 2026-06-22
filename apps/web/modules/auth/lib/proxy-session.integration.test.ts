import { beforeEach, describe, expect, test } from "vitest";
import { prisma } from "@formbricks/database";
import { resetDb } from "@/integration/reset-db";
import { auth } from "@/modules/auth/lib/auth";
import { getProxySession } from "@/modules/auth/lib/proxy-session";
import { BETTER_AUTH_SESSION_COOKIE_NAMES } from "@/modules/auth/lib/session-cookie";

/**
 * Integration coverage for the forward-auth proxy (ENG-1054 cutover C2) against real Postgres.
 *
 * The decisive cross-check: it signs in through the REAL Better Auth handler, takes the signed
 * session cookie BA issued (better-call's `serializeSignedCookie`), and proves getProxySession's
 * HMAC verification (session-cookie.ts) + authoritative DB lookup (expiry / isActive) accept it — i.e.
 * Better Auth's cookie signing and our verification agree on a real cookie, not just a self-signed
 * fixture. Forced re-login (D3 reversed): ONLY a valid BA-signed cookie backed by a live, active
 * session resolves — there is no NextAuth fallback.
 */
const PASSWORD = "Correct-Horse1";

/** Sign up + verify + sign in via the real BA handler, returning the session cookie BA set. */
const signInAndGetSessionCookie = async (email: string): Promise<{ name: string; value: string }> => {
  await auth.api.signUpEmail({ body: { email, password: PASSWORD, name: "Proxy User" }, asResponse: true });
  await prisma.user.update({ where: { email }, data: { emailVerified: true } });

  const res = await auth.api.signInEmail({ body: { email, password: PASSWORD }, asResponse: true });
  expect(res.status).toBe(200);

  const setCookies = res.headers.getSetCookie?.() ?? [];
  for (const setCookie of setCookies) {
    const pair = setCookie.split(";", 1)[0];
    const eq = pair.indexOf("=");
    const name = pair.slice(0, eq).trim();
    const value = pair.slice(eq + 1);
    if ((BETTER_AUTH_SESSION_COOKIE_NAMES as readonly string[]).includes(name)) {
      return { name, value };
    }
  }
  throw new Error(`No Better Auth session cookie in Set-Cookie: ${setCookies.join(" | ")}`);
};

const requestWith = (cookies: Record<string, string>) => ({
  cookies: { get: (name: string) => (cookies[name] ? { value: cookies[name] } : undefined) },
});

beforeEach(async () => {
  await resetDb();
});

describe("Forward-auth proxy — getProxySession with real Better Auth cookies (real Postgres)", () => {
  test("resolves a real BA-signed session cookie to its user", async () => {
    const cookie = await signInAndGetSessionCookie("proxy-valid@example.com");
    const user = await prisma.user.findUnique({ where: { email: "proxy-valid@example.com" } });

    const session = await getProxySession(requestWith({ [cookie.name]: cookie.value }));
    expect(session?.userId).toBe(user?.id);
  });

  test("rejects a cookie whose signature has been tampered with", async () => {
    const cookie = await signInAndGetSessionCookie("proxy-tampered@example.com");
    // Mutate the token byte so the HMAC no longer matches.
    const tampered = (cookie.value[0] === "a" ? "b" : "a") + cookie.value.slice(1);

    expect(await getProxySession(requestWith({ [cookie.name]: tampered }))).toBeNull();
  });

  test("does not resolve an expired session", async () => {
    const cookie = await signInAndGetSessionCookie("proxy-expired@example.com");
    await prisma.session.updateMany({ data: { expires: new Date(Date.now() - 60_000) } });

    expect(await getProxySession(requestWith({ [cookie.name]: cookie.value }))).toBeNull();
  });

  test("does not resolve a session for a deactivated user", async () => {
    const cookie = await signInAndGetSessionCookie("proxy-inactive@example.com");
    await prisma.user.update({ where: { email: "proxy-inactive@example.com" }, data: { isActive: false } });

    expect(await getProxySession(requestWith({ [cookie.name]: cookie.value }))).toBeNull();
  });

  test("does not resolve once the session row is gone", async () => {
    const cookie = await signInAndGetSessionCookie("proxy-deleted@example.com");
    await prisma.session.deleteMany({});

    expect(await getProxySession(requestWith({ [cookie.name]: cookie.value }))).toBeNull();
  });

  test("returns null when there is no session cookie", async () => {
    expect(await getProxySession(requestWith({}))).toBeNull();
  });
});
