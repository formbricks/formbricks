import { beforeEach, describe, expect, test } from "vitest";
import { prisma } from "@formbricks/database";
import { resetDb } from "@/integration/reset-db";
import { WEBAPP_URL } from "@/lib/constants";
import { createToken } from "@/lib/jwt";
import { auth } from "@/modules/auth/lib/auth";
import { syncSsoIdentityForUser } from "@/modules/ee/sso/lib/account-linking";

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
    const callbackUrl = `${WEBAPP_URL}/api/auth/sso/recovery/complete?state=test-state`;

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

/**
 * ENG-2555. The unit tests for `syncSsoIdentityForUser` mock Prisma and assert the issuer *we* pass, so
 * they can only ever confirm the value we chose — which is exactly how a wrong one shipped. These assert
 * the property that actually matters: after recovery links an account, a 1.7.0 pod can find it again.
 *
 * Better Auth 1.7.7 finds accounts by `(providerId, accountId)` and ignores `issuer`, but 1.7.0 keyed them
 * on `(issuer, accountId)`, so this is the rollback guarantee. The key is reproduced the way 1.7.0 built
 * it (a declared `accountIssuer` wins, else the synthetic form), as frozen literals: those values are in
 * rows 1.7.0 and the migrations already wrote, so they no longer track upstream.
 */
describe("SSO recovery writes the issuer a Better Auth 1.7.0 rollback finds (real Postgres)", () => {
  const findByRollbackKey = (issuer: string, accountId: string) =>
    prisma.account.findUnique({
      where: { issuer_providerAccountId: { issuer, providerAccountId: accountId } },
      select: { userId: true, provider: true },
    });

  test.each([
    // google declared its own issuer in 1.7.0 — the case that broke
    ["google", "google-sub-1", "https://accounts.google.com"],
    // github declared none, so the synthetic form is correct for it
    ["github", "github-id-1", "local:oauth:github"],
  ] as const)("links %s under the key 1.7.0 looks it up by", async (provider, sub, expectedIssuer) => {
    const user = await prisma.user.create({
      data: { email: `${provider}-link@example.com`, name: "Linked", emailVerified: true },
    });

    await prisma.$transaction((tx) =>
      syncSsoIdentityForUser({
        userId: user.id,
        provider,
        account: { type: "oauth", provider, providerAccountId: sub },
        tx,
      })
    );

    const found = await findByRollbackKey(expectedIssuer, sub);

    expect(found).not.toBeNull();
    expect(found?.userId).toBe(user.id);
    expect(found?.provider).toBe(provider);
  });

  /**
   * The branch that made the bug unbreakable: a row already carrying a wrong issuer must be repaired by
   * the next recovery, not left alone. Before the fix this update wrote tokens only.
   */
  test("repairs a row that already carries a wrong issuer", async () => {
    const user = await prisma.user.create({
      data: { email: "stomped@example.com", name: "Stomped", emailVerified: true },
    });
    await prisma.account.create({
      data: {
        userId: user.id,
        type: "oauth",
        provider: "google",
        providerAccountId: "google-sub-2",
        issuer: "local:oauth:google",
      },
    });

    await prisma.$transaction((tx) =>
      syncSsoIdentityForUser({
        userId: user.id,
        provider: "google",
        account: { type: "oauth", provider: "google", providerAccountId: "google-sub-2" },
        tx,
      })
    );

    expect(await findByRollbackKey("https://accounts.google.com", "google-sub-2")).not.toBeNull();
    // and no duplicate was created in the process
    expect(await prisma.account.count({ where: { userId: user.id } })).toBe(1);
  });
});
