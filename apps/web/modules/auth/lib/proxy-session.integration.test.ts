import { beforeEach, describe, expect, test } from "vitest";
import { prisma } from "@formbricks/database";
import { resetDb } from "@/integration/reset-db";
import { getProxySession } from "@/modules/auth/lib/proxy-session";

/**
 * Integration coverage for the dual-read cutover fallback (ENG-1054) against real Postgres.
 *
 * Proves the cutover continuity guarantee: an existing NextAuth-era session (a real Session row + the
 * legacy cookie) still resolves via getProxySession on the POST-Better-Auth-migration schema — so
 * existing users keep their session at the flip with NO forced re-login. The dual-read DAL (Phase 7)
 * will use getProxySession as its fallback when there's no Better Auth session, so this is the half of
 * the dual-read that carries aging-out NextAuth cookies. The unit test (proxy-session.test.ts) covers
 * the branch logic with a mocked prisma; this proves the real query + expiry/isActive checks against
 * the actual migrated database.
 */
const ONE_HOUR = 60 * 60 * 1000;

const requestWithToken = (token: string | null, cookieName = "next-auth.session-token") => ({
  cookies: {
    get: (name: string) => (token && name === cookieName ? { value: token } : undefined),
  },
});

const createUser = (email: string, isActive = true) =>
  prisma.user.create({
    data: { email, name: "Legacy Session User", emailVerified: true, isActive },
  });

beforeEach(async () => {
  await resetDb();
});

describe("Dual-read cutover fallback — getProxySession (real Postgres)", () => {
  test("an existing NextAuth session resolves on the post-migration schema (no forced re-login)", async () => {
    const user = await createUser("legacy-session@example.com");
    await prisma.session.create({
      data: {
        sessionToken: "legacy-token-active",
        userId: user.id,
        expires: new Date(Date.now() + ONE_HOUR),
      },
    });

    const session = await getProxySession(requestWithToken("legacy-token-active"));
    expect(session?.userId).toBe(user.id);
  });

  test("resolves via the __Secure- cookie name too", async () => {
    const user = await createUser("legacy-secure@example.com");
    await prisma.session.create({
      data: {
        sessionToken: "legacy-token-secure",
        userId: user.id,
        expires: new Date(Date.now() + ONE_HOUR),
      },
    });

    const session = await getProxySession(
      requestWithToken("legacy-token-secure", "__Secure-next-auth.session-token")
    );
    expect(session?.userId).toBe(user.id);
  });

  test("an expired session does not resolve", async () => {
    const user = await createUser("legacy-expired@example.com");
    await prisma.session.create({
      data: { sessionToken: "legacy-token-expired", userId: user.id, expires: new Date(Date.now() - 60_000) },
    });

    expect(await getProxySession(requestWithToken("legacy-token-expired"))).toBeNull();
  });

  test("a session for a deactivated user does not resolve", async () => {
    const user = await createUser("legacy-inactive@example.com", false);
    await prisma.session.create({
      data: {
        sessionToken: "legacy-token-inactive",
        userId: user.id,
        expires: new Date(Date.now() + ONE_HOUR),
      },
    });

    expect(await getProxySession(requestWithToken("legacy-token-inactive"))).toBeNull();
  });

  test("an unknown session token does not resolve", async () => {
    expect(await getProxySession(requestWithToken("does-not-exist"))).toBeNull();
  });
});
