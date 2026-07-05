import { beforeEach, describe, expect, test } from "vitest";
import { prisma } from "@formbricks/database";
import { resetDb } from "@/integration/reset-db";
import { WEBAPP_URL } from "@/lib/constants";
import { createToken } from "@/lib/jwt";
import { auth } from "@/modules/auth/lib/auth";

/**
 * Integration coverage for the SSO-recovery magic-link sign-in (ENG-1054, Phase 7) against real
 * Postgres. Proves the BA replacement for the NextAuth "token" provider's sso_recovery path: a valid
 * recovery token establishes a real session and redirects to the completion route, while non-recovery
 * tokens and inactive users are rejected with no session.
 */
beforeEach(async () => {
  await resetDb();
});

describe("SSO recovery sign-in (real Postgres)", () => {
  test("a valid sso_recovery token establishes a session and redirects to the callback", async () => {
    const user = await prisma.user.create({
      data: { email: "recover@example.com", name: "Recover", emailVerified: true },
    });
    const token = createToken(user.id, { purpose: "sso_recovery" });
    const callbackUrl = `${WEBAPP_URL}/api/auth/sso/recovery/complete?intent=test-intent`;

    const res = await auth.api.ssoRecoverySignIn({ query: { token, callbackUrl }, asResponse: true });

    // a real BA session was created (and the cookie set on the redirect response)
    expect(await prisma.session.count({ where: { userId: user.id } })).toBe(1);
    expect(res.headers.get("location")).toContain("/api/auth/sso/recovery/complete");
    // the session cookie must land on the redirect response (not just the DB row)
    expect(res.headers.getSetCookie().some((c) => c.includes("session_token"))).toBe(true);
  });

  test("a token with a non-recovery purpose creates no session", async () => {
    const user = await prisma.user.create({
      data: { email: "wrongpurpose@example.com", name: "Wrong", emailVerified: true },
    });
    const token = createToken(user.id, { purpose: "email_verification" });

    const res = await auth.api.ssoRecoverySignIn({
      query: { token, callbackUrl: WEBAPP_URL },
      asResponse: true,
    });

    expect(await prisma.session.count({ where: { userId: user.id } })).toBe(0);
    expect(res.headers.get("location")).toContain("/auth/login"); // redirected to the recovery failure page
  });

  test("an inactive user is not signed in", async () => {
    const user = await prisma.user.create({
      data: { email: "inactive@example.com", name: "Inactive", emailVerified: true, isActive: false },
    });
    const token = createToken(user.id, { purpose: "sso_recovery" });

    await auth.api.ssoRecoverySignIn({ query: { token, callbackUrl: WEBAPP_URL }, asResponse: true });

    expect(await prisma.session.count({ where: { userId: user.id } })).toBe(0);
  });

  test("the recovery token is replayable until expiry (parity with the legacy token provider)", async () => {
    const user = await prisma.user.create({
      data: { email: "replay@example.com", name: "Replay", emailVerified: true },
    });
    const token = createToken(user.id, { purpose: "sso_recovery" });
    const query = { token, callbackUrl: WEBAPP_URL };

    await auth.api.ssoRecoverySignIn({ query, asResponse: true });
    await auth.api.ssoRecoverySignIn({ query, asResponse: true });

    // not single-use: the same token signs in twice (documents the known replay-until-expiry parity)
    expect(await prisma.session.count({ where: { userId: user.id } })).toBe(2);
  });
});
