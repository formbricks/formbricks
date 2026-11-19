import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { SSO_RECOVERY_SECOND_FACTOR_UNAVAILABLE_ERROR_CODE } from "@formbricks/types/errors";
import { resetDb } from "@/integration/reset-db";
import type * as ConstantsModule from "@/lib/constants";
import { WEBAPP_URL } from "@/lib/constants";
import { createToken } from "@/lib/jwt";
import { auth } from "@/modules/auth/lib/auth";
import { syncSsoIdentityForUser } from "@/modules/ee/sso/lib/account-linking";
import { SSO_RECOVERY_PROOF_COOKIE_NAME, isValidSsoRecoveryProof } from "@/modules/ee/sso/lib/recovery-proof";
import { proofCookieOf } from "@/modules/ee/sso/lib/tests/recovery-cookies";

const constants = vi.hoisted(() => ({ emailAuthEnabled: { value: true } }));

/**
 * ENG-7266. `EMAIL_AUTH_ENABLED` is a module-load const derived from the environment, and the redirect
 * decision has to read it live, so this suite holds it in a box it can flip per test. Everything else
 * stays real: `auth` itself reads several constants from the same module at import, and captures its
 * own `emailAndPassword.enabled` there — so a flip here changes the redirect decision only, which is
 * all these assertions read.
 */
vi.mock("@/lib/constants", async (importOriginal) => ({
  ...(await importOriginal<typeof ConstantsModule>()),
  get EMAIL_AUTH_ENABLED() {
    return constants.emailAuthEnabled.value;
  },
}));

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
  /**
   * ENG-7310. Opening the emailed link is the only step that proves the mailbox, so it is where the
   * browser gets the proof the completion route demands. Both branches complete in this browser: the
   * session one directly, the 2FA one after the login page.
   */
  test.each([
    ["the session path", { emailVerified: true, twoFactorEnabled: false }],
    ["the 2FA path", { emailVerified: true, twoFactorEnabled: true }],
  ])("sets a proof bound to this user and recovery on %s", async (_label, flags) => {
    const user = await prisma.user.create({ data: { email: "proof@example.com", name: "Proof", ...flags } });
    const token = createToken(user.id, { purpose: "sso_recovery", ssoRecoveryStateId: "proof-state" });
    const callbackUrl = `${WEBAPP_URL}/api/auth/sso/recovery/complete?state=proof-state`;

    const res = await auth.api.ssoRecoverySignIn({ query: { token, callbackUrl }, asResponse: true });

    const proof = proofCookieOf(res);
    expect(isValidSsoRecoveryProof(proof, user.id, "proof-state")).toBe(true);
    const setCookie = res.headers
      .getSetCookie()
      .find((c) => c.startsWith(`${SSO_RECOVERY_PROOF_COOKIE_NAME}=`));
    expect(setCookie).toMatch(/HttpOnly/i);
    expect(setCookie).toMatch(/SameSite=Lax/i);
  });

  /**
   * The token is signed and the `callbackUrl` beside it is not, so the proof follows the state the token
   * was mailed for. A link minted before the binding existed carries no state and earns no proof: the
   * user gets the "open the emailed link" message and starts again.
   */
  test.each([
    ["a token bound to another recovery", { ssoRecoveryStateId: "other-state" }],
    ["a token bound to no recovery", {}],
  ])("sets no proof for %s", async (_label, binding) => {
    const user = await prisma.user.create({ data: { email: "unbound@example.com", name: "Unbound" } });
    const token = createToken(user.id, { purpose: "sso_recovery", ...binding });
    const callbackUrl = `${WEBAPP_URL}/api/auth/sso/recovery/complete?state=proof-state`;

    const res = await auth.api.ssoRecoverySignIn({ query: { token, callbackUrl }, asResponse: true });

    expect(proofCookieOf(res)).toBeNull();
    // Only the proof is withheld; the link still signs the mailbox owner in as before.
    expect(res.headers.get("location")).toBe(callbackUrl);
  });

  test("sets no proof when the callback is not a recovery completion", async () => {
    const user = await prisma.user.create({ data: { email: "noproof@example.com", name: "No Proof" } });
    // Bound to the state in the callback, so only the path check can withhold the proof.
    const token = createToken(user.id, { purpose: "sso_recovery", ssoRecoveryStateId: "proof-state" });

    const res = await auth.api.ssoRecoverySignIn({
      query: { token, callbackUrl: `${WEBAPP_URL}/environments/env_1?state=proof-state` },
      asResponse: true,
    });

    expect(proofCookieOf(res)).toBeNull();
  });

  test("sets no proof for a token that is not an SSO recovery token", async () => {
    const user = await prisma.user.create({ data: { email: "wrongpurpose@example.com", name: "Wrong" } });
    // Bound to the state in the callback, so only the purpose check can withhold the proof.
    const token = createToken(user.id, { ssoRecoveryStateId: "proof-state" });
    const callbackUrl = `${WEBAPP_URL}/api/auth/sso/recovery/complete?state=proof-state`;

    const res = await auth.api.ssoRecoverySignIn({ query: { token, callbackUrl }, asResponse: true });

    expect(proofCookieOf(res)).toBeNull();
  });

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

  /**
   * ENG-7266. The link proves mailbox access only; for a verified 2FA account that must not replace the
   * second factor. No session, no cookie, and the login page carries the completion URL so the user
   * finishes recovery after password + TOTP.
   */
  test("a verified 2FA user gets no session and is sent to login with the completion URL", async () => {
    const user = await prisma.user.create({
      data: {
        email: "twofactor@example.com",
        name: "Two Factor",
        emailVerified: true,
        twoFactorEnabled: true,
      },
    });
    const token = createToken(user.id, { purpose: "sso_recovery" });
    const callbackUrl = `${WEBAPP_URL}/api/auth/sso/recovery/complete?state=test-state`;

    const res = await auth.api.ssoRecoverySignIn({ query: { token, callbackUrl }, asResponse: true });

    expect(await prisma.session.count({ where: { userId: user.id } })).toBe(0);
    expect(res.headers.getSetCookie().some((c) => c.includes("session_token"))).toBe(false);
    const location = new URL(res.headers.get("location") ?? "");
    expect(location.pathname).toBe("/auth/login");
    expect(location.searchParams.get("error")).toBeNull();
    expect(location.searchParams.get("callbackUrl")).toBe(callbackUrl);
  });

  // Recovery strips an unverified account's local factors on completion (ENG-2557), so the factor set
  // by a possible squatter is not one the mailbox owner can be asked for.
  test("an unverified user with 2FA still gets the recovery session", async () => {
    const user = await prisma.user.create({
      data: {
        email: "unverified-2fa@example.com",
        name: "Unverified",
        emailVerified: false,
        twoFactorEnabled: true,
      },
    });
    const token = createToken(user.id, { purpose: "sso_recovery" });

    await auth.api.ssoRecoverySignIn({ query: { token, callbackUrl: WEBAPP_URL }, asResponse: true });

    expect(await prisma.session.count({ where: { userId: user.id } })).toBe(1);
  });

  /**
   * ENG-7266 with `EMAIL_AUTH_DISABLED=1`. The login page renders no credential form there, so
   * password + TOTP cannot run, and the identity that started recovery is unlinked by definition. The
   * redirect has to name that dead end instead of sending the user around the loop again.
   */
  test("with credential sign-in off, the 2FA deferral carries the unavailable error code", async () => {
    const user = await prisma.user.create({
      data: {
        email: "twofactor-sso-only@example.com",
        name: "Two Factor Sso Only",
        emailVerified: true,
        twoFactorEnabled: true,
      },
    });
    const token = createToken(user.id, { purpose: "sso_recovery" });
    const callbackUrl = `${WEBAPP_URL}/api/auth/sso/recovery/complete?state=test-state`;

    constants.emailAuthEnabled.value = false;
    try {
      const res = await auth.api.ssoRecoverySignIn({ query: { token, callbackUrl }, asResponse: true });

      expect(await prisma.session.count({ where: { userId: user.id } })).toBe(0);
      const location = new URL(res.headers.get("location") ?? "");
      expect(location.pathname).toBe("/auth/login");
      expect(location.searchParams.get("error")).toBe(SSO_RECOVERY_SECOND_FACTOR_UNAVAILABLE_ERROR_CODE);
      expect(location.searchParams.get("callbackUrl")).toBe(callbackUrl);
    } finally {
      constants.emailAuthEnabled.value = true;
    }
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
