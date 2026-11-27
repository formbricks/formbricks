import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { SSO_RECOVERY_SECOND_FACTOR_UNAVAILABLE_ERROR_CODE } from "@formbricks/types/errors";
import { resetDb } from "@/integration/reset-db";
import type * as ConstantsModule from "@/lib/constants";
import { WEBAPP_URL } from "@/lib/constants";
import { createToken } from "@/lib/jwt";
import { auth } from "@/modules/auth/lib/auth";
import { syncSsoIdentityForUser } from "@/modules/ee/sso/lib/account-linking";
import { consumeSsoRecoveryIntent, createSsoRecoveryIntent } from "@/modules/ee/sso/lib/recovery-intent";
import { getSsoRecoveryFailureRedirectUrl } from "@/modules/ee/sso/lib/recovery-outcomes";
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

/** Stores a live recovery for the user, as `startSsoRecovery` does, and returns its state id. */
const startRecovery = async (userId: string): Promise<string> => {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { email: true } });
  return createSsoRecoveryIntent({
    userId,
    email: user.email,
    provider: "google",
    providerAccountId: `google-sub-${userId}`,
    callbackUrl: WEBAPP_URL,
  });
};

/** Spends a recovery the way Link and Cancel do. */
const spendRecovery = async (stateId: string): Promise<string> => {
  if (!(await consumeSsoRecoveryIntent(stateId))) throw new Error("fixture: recovery was not stored");
  return stateId;
};

const completionUrlFor = (stateId: string) => `${WEBAPP_URL}/api/auth/sso/recovery/complete?state=${stateId}`;

/** The link `startSsoRecovery` mails: a token bound to a live recovery, and that recovery's completion URL. */
const mailedRecoveryLink = async (userId: string) => {
  const stateId = await startRecovery(userId);
  const token = createToken(userId, { purpose: "sso_recovery", ssoRecoveryStateId: stateId });
  return { stateId, token, callbackUrl: completionUrlFor(stateId) };
};

const otherUserRecovery = async (): Promise<string> => {
  const other = await prisma.user.create({ data: { email: "other@example.com", name: "Other" } });
  return startRecovery(other.id);
};

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
    const { stateId, token, callbackUrl } = await mailedRecoveryLink(user.id);

    const res = await auth.api.ssoRecoverySignIn({ query: { token, callbackUrl }, asResponse: true });

    const proof = proofCookieOf(res);
    expect(isValidSsoRecoveryProof(proof, user.id, stateId)).toBe(true);
    const setCookie = res.headers
      .getSetCookie()
      .find((c) => c.startsWith(`${SSO_RECOVERY_PROOF_COOKIE_NAME}=`));
    expect(setCookie).toMatch(/HttpOnly/i);
    expect(setCookie).toMatch(/SameSite=Lax/i);
  });

  /**
   * The token is signed and the `callbackUrl` beside it is not, so the proof follows the state the token
   * was mailed for. A callback naming another of the user's recoveries earns no proof. A token bound to
   * no live recovery at all signs nobody in (ENG-7422, below).
   */
  test("sets no proof for a token bound to another recovery", async () => {
    const user = await prisma.user.create({ data: { email: "unbound@example.com", name: "Unbound" } });
    const { token } = await mailedRecoveryLink(user.id);
    const callbackUrl = completionUrlFor(await startRecovery(user.id));

    const res = await auth.api.ssoRecoverySignIn({ query: { token, callbackUrl }, asResponse: true });

    expect(proofCookieOf(res)).toBeNull();
    // Only the proof is withheld; the link still signs the mailbox owner in.
    expect(res.headers.get("location")).toBe(callbackUrl);
  });

  test("sets no proof when the callback is not a recovery completion", async () => {
    const user = await prisma.user.create({ data: { email: "noproof@example.com", name: "No Proof" } });
    // Bound to the state in the callback, so only the path check can withhold the proof.
    const { stateId, token } = await mailedRecoveryLink(user.id);

    const res = await auth.api.ssoRecoverySignIn({
      query: { token, callbackUrl: `${WEBAPP_URL}/environments/env_1?state=${stateId}` },
      asResponse: true,
    });

    expect(proofCookieOf(res)).toBeNull();
  });

  test("sets no proof for a token that is not an SSO recovery token", async () => {
    const user = await prisma.user.create({ data: { email: "wrongpurpose@example.com", name: "Wrong" } });
    // Bound to the state in the callback, so only the purpose check can withhold the proof.
    const stateId = await startRecovery(user.id);
    const token = createToken(user.id, { ssoRecoveryStateId: stateId });
    const callbackUrl = `${WEBAPP_URL}/api/auth/sso/recovery/complete?state=${stateId}`;

    const res = await auth.api.ssoRecoverySignIn({ query: { token, callbackUrl }, asResponse: true });

    expect(proofCookieOf(res)).toBeNull();
  });

  test("a valid sso_recovery token establishes a session and redirects to the callback", async () => {
    const user = await prisma.user.create({
      data: { email: "recover@example.com", name: "Recover", emailVerified: true },
    });
    const { token, callbackUrl } = await mailedRecoveryLink(user.id);

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
    const { token, callbackUrl } = await mailedRecoveryLink(user.id);

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
    const { token, callbackUrl } = await mailedRecoveryLink(user.id);

    await auth.api.ssoRecoverySignIn({ query: { token, callbackUrl }, asResponse: true });

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
    const { token, callbackUrl } = await mailedRecoveryLink(user.id);

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

  test("a 2FA account with a hostile callback is sent to a bare login page", async () => {
    const user = await prisma.user.create({
      data: { email: "twofa-evil@example.com", name: "TwoFa", emailVerified: true, twoFactorEnabled: true },
    });
    const { token } = await mailedRecoveryLink(user.id);

    const res = await auth.api.ssoRecoverySignIn({
      query: { token, callbackUrl: "https://evil.example/phish" },
      asResponse: true,
    });

    expect(await prisma.session.count({ where: { userId: user.id } })).toBe(0);
    expect(res.headers.get("location")).toBe(`${WEBAPP_URL}/auth/login`);
  });

  test("an inactive 2FA account is refused with the recovery failure redirect", async () => {
    const user = await prisma.user.create({
      data: {
        email: "twofa-inactive@example.com",
        name: "TwoFa",
        emailVerified: true,
        twoFactorEnabled: true,
        isActive: false,
      },
    });
    const { token, callbackUrl } = await mailedRecoveryLink(user.id);

    const res = await auth.api.ssoRecoverySignIn({
      query: { token, callbackUrl },
      asResponse: true,
    });

    expect(await prisma.session.count({ where: { userId: user.id } })).toBe(0);
    expect(res.headers.get("location")).toBe(getSsoRecoveryFailureRedirectUrl(callbackUrl));
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
    const { token, callbackUrl } = await mailedRecoveryLink(user.id);

    await auth.api.ssoRecoverySignIn({ query: { token, callbackUrl }, asResponse: true });

    expect(await prisma.session.count({ where: { userId: user.id } })).toBe(0);
  });

  /**
   * ENG-7422 review. A Link can commit and run its session sweep between this endpoint's intent read and
   * its session write. The session written in that window would outlive the sweep, so the endpoint
   * checks the intent again after writing and takes the session back when the recovery is gone.
   */
  test("a recovery spent while the session is being created leaves no session behind", async () => {
    const user = await prisma.user.create({
      data: { email: "race@example.com", name: "Race", emailVerified: true },
    });
    const { stateId, token, callbackUrl } = await mailedRecoveryLink(user.id);
    const { internalAdapter } = await auth.$context;
    const createSession = internalAdapter.createSession.bind(internalAdapter);
    const spy = vi.spyOn(internalAdapter, "createSession").mockImplementationOnce(async (...args) => {
      const session = await createSession(...args);
      await spendRecovery(stateId); // Link commits and spends the intent right after the write
      return session;
    });

    try {
      const res = await auth.api.ssoRecoverySignIn({ query: { token, callbackUrl }, asResponse: true });

      expect(spy).toHaveBeenCalledOnce();
      expect(await prisma.session.count({ where: { userId: user.id } })).toBe(0);
      expect(res.headers.getSetCookie().some((c) => c.includes("session_token"))).toBe(false);
      expect(res.headers.get("location")).toBe(getSsoRecoveryFailureRedirectUrl(callbackUrl));
    } finally {
      spy.mockRestore();
    }
  });

  /**
   * ENG-7422. The link works only while the recovery it was mailed for is live, and Link and Cancel both
   * spend that recovery. So a link the token does not tie to a live recovery of this user signs nobody
   * in: the recovery behind it is spent or expired, or was never this user's.
   */
  test.each([
    ["bound to no recovery", (_userId: string) => Promise.resolve(undefined)],
    ["bound to a recovery that is spent", (userId: string) => startRecovery(userId).then(spendRecovery)],
    ["bound to another user's recovery", () => otherUserRecovery()],
  ])("a token %s signs nobody in", async (_label, bindTo) => {
    const user = await prisma.user.create({
      data: { email: "spent@example.com", name: "Spent", emailVerified: true },
    });
    const ssoRecoveryStateId = await bindTo(user.id);
    const token = createToken(user.id, { purpose: "sso_recovery", ssoRecoveryStateId });
    const callbackUrl = completionUrlFor(ssoRecoveryStateId ?? "none");

    const res = await auth.api.ssoRecoverySignIn({ query: { token, callbackUrl }, asResponse: true });

    expect(await prisma.session.count({ where: { userId: user.id } })).toBe(0);
    expect(proofCookieOf(res)).toBeNull();
    expect(res.headers.get("location")).toBe(getSsoRecoveryFailureRedirectUrl(callbackUrl));
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
