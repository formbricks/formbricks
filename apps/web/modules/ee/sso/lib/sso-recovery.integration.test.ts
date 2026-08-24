import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { resetDb } from "@/integration/reset-db";
import { ENCRYPTION_KEY, WEBAPP_URL } from "@/lib/constants";
import { symmetricEncrypt } from "@/lib/crypto";
import { createSsoRelinkIntent } from "@/lib/jwt";
import { auth } from "@/modules/auth/lib/auth";
import { getSessionTokenFromCookieHeader } from "@/modules/auth/lib/session-cookie";
import { completeSsoRecovery } from "@/modules/ee/sso/lib/sso-recovery";
import { sendPasswordResetLinkEmail } from "@/modules/email";

/**
 * The real red-green proof for ENG-2557, against real Postgres and real Redis.
 *
 * The bug was invisible to the unit suite for a reason worth restating: the control looked present, wrote
 * to `User.password` / `User.twoFactorSecret`, and asserted exactly that — but ENG-1054 had moved both
 * factors elsewhere, so it stripped nothing. Only a test that drives Better Auth's own sign-in against a
 * real database can tell "the password is gone" from "we nulled a column nobody reads".
 *
 * Every security assertion here therefore goes through `auth.api.*` rather than reading columns.
 */

// EMAIL_VERIFICATION_DISABLED differs between environments — `0` in a dev `.env`, `1` in the `.env.example`
// CI copies — and `auth.ts` turns it into `requireEmailVerification` at import time. Pinning it keeps this
// file identical everywhere, and `1` is deliberately the *vulnerable* posture: it is what lets an account
// with an unproven address hold a live session, which is the state the session sweep exists for.
vi.mock("@/lib/constants", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/constants")>()),
  EMAIL_VERIFICATION_DISABLED: true,
  // A dev `.env` ships PASSWORD_RESET_DISABLED=1 (CI's fixups flip it); the lockout test below drives a
  // real reset, so pin it open.
  PASSWORD_RESET_DISABLED: false,
}));

// Fires inside setImmediate and calls getClientIpFromHeaders() outside a request scope.
vi.mock("@/modules/ee/audit-logs/lib/handler", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/modules/ee/audit-logs/lib/handler")>()),
  queueAuditEventBackground: vi.fn(async () => undefined),
}));

const ATTACKER_PASSWORD = "Passw0rd!squatter";
const VICTIM_EMAIL = "victim@example.com";

/**
 * Only the session-token cookie from a sign-in response, deliberately dropping `session_data`: with
 * `cookieCache` enabled, `getSession` serves a still-valid `session_data` cookie straight from its
 * signature without consulting Redis or Postgres. Carrying it along would make every revocation
 * assertion below pass OR fail for the wrong reason — the cache window (5 min) is a documented residual
 * of any revocation here, `revokeSessionsOnPasswordReset` included, not something these tests can bind.
 */
const sessionTokenCookie = (response: Response): string => {
  const cookie = response.headers
    .getSetCookie()
    .map((setCookie) => setCookie.split(";")[0])
    .find((pair) => pair.startsWith("formbricks.session_token="));
  expect(cookie).toBeTruthy();
  return cookie!;
};

const signIn = (password: string): Promise<Response> =>
  auth.api.signInEmail({ body: { email: VICTIM_EMAIL, password }, asResponse: true });

/**
 * The squatter's starting state: an account on someone else's address, with a working password and an
 * unproven email. Built through `signUpEmail` rather than by hand on purpose — 1.7 filters
 * `findCredentialAccount` on `issuer`, so a hand-seeded credential row would reject a *correct* password
 * and every assertion below would pass for the wrong reason.
 *
 * Deliberately does NOT enrol 2FA: for a `twoFactorEnabled` user Better Auth's sign-in hook deletes the
 * just-minted session and answers with a challenge instead, so any test that needs a real session cookie
 * from `signIn` must enrol 2FA only AFTER minting it (`enrollTwoFactor` below).
 */
const seedUnprovenAccountWithPassword = async () => {
  await auth.api.signUpEmail({
    body: { email: VICTIM_EMAIL, password: ATTACKER_PASSWORD, name: "Squatter" },
    asResponse: true,
  });
  const user = await prisma.user.findUniqueOrThrow({ where: { email: VICTIM_EMAIL } });
  expect(user.emailVerified).toBe(false);

  return user;
};

/**
 * A 2FA enrolment in both stores, the shape `enableTwoFactorAuth` leaves behind. The `TwoFactor` row's
 * contents never need to verify (assertions only count rows), but the LEGACY columns must be genuinely
 * decryptable: the backfill shim re-encodes them on sign-in inside a swallow-all try/catch, so a
 * placeholder there would make the resurrection assertion below pass because the shim crashed, not
 * because recovery disarmed it.
 */
const enrollTwoFactor = async (userId: string) => {
  await prisma.twoFactor.create({
    data: { userId, secret: "encrypted-secret", backupCodes: "encrypted-backup-codes" },
  });
  await prisma.user.update({
    where: { id: userId },
    data: {
      twoFactorEnabled: true,
      twoFactorSecret: symmetricEncrypt("JBSWY3DPEHPK3PXP", ENCRYPTION_KEY),
      backupCodes: symmetricEncrypt(JSON.stringify(["aaaaabbbbb", "cccccddddd"]), ENCRYPTION_KEY),
    },
  });
};

/** The session the recovery link mints, which completion runs on and the sweep must spare. */
const createRecoverySession = async (userId: string): Promise<string> => {
  const ctx = await auth.$context;
  const session = await ctx.internalAdapter.createSession(userId, false);
  return session.token;
};

const runRecovery = (user: { id: string; email: string }, sessionToken: string) =>
  completeSsoRecovery({
    intentToken: createSsoRelinkIntent({
      userId: user.id,
      email: user.email,
      provider: "google",
      providerAccountId: "google-sub-recovery-1",
      callbackUrl: WEBAPP_URL,
    }),
    sessionUserId: user.id,
    sessionToken,
  });

beforeEach(async () => {
  await resetDb();
  vi.mocked(sendPasswordResetLinkEmail).mockClear();
});

describe("SSO recovery strips the live local auth factors (real Postgres + Redis)", () => {
  test("the squatter's password no longer authenticates after the address is proven", async () => {
    const user = await seedUnprovenAccountWithPassword();

    // Anti-vacuity: the password genuinely signs in before recovery. Without this the assertion below
    // can pass because the fixture silently failed — the exact failure mode that let this ship.
    expect((await signIn(ATTACKER_PASSWORD)).status).toBe(200);
    // Test-only cleanup of the precondition session's row, so this test asserts only the password strip
    // and stays green even if the session sweep were to regress (it has its own tests below).
    await prisma.session.deleteMany({});

    await runRecovery(user, await createRecoverySession(user.id));

    // Pre-fix this was 200: the strip nulled `User.password` while the live hash sat on `Account`.
    expect((await signIn(ATTACKER_PASSWORD)).status).toBe(401);
    // A rejection alone can be right for the wrong reason, so also check nothing was minted: the
    // recovery session must be the only one that exists.
    expect(await prisma.session.count({ where: { userId: user.id } })).toBe(1);
  });

  test("the 2FA enrolment does not survive on an account that changed hands", async () => {
    const user = await seedUnprovenAccountWithPassword();
    await enrollTwoFactor(user.id);

    await runRecovery(user, await createRecoverySession(user.id));

    // Pre-fix this was 1. Dormant rather than exploitable (Better Auth gates its challenge on
    // `user.twoFactorEnabled`, which the legacy update already cleared), but a stale TOTP secret and
    // backup codes must not outlive the handover.
    expect(await prisma.twoFactor.count({ where: { userId: user.id } })).toBe(0);
    // The legacy columns stay null too: `better-auth-two-factor-backfill` rebuilds a `TwoFactor` row from
    // them on the next credential sign-in, so leaving them set would re-arm the factor.
    const after = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(after.twoFactorEnabled).toBe(false);
    expect(after.twoFactorSecret).toBeNull();
    expect(after.backupCodes).toBeNull();
  });

  test("a session the squatter was holding stops resolving, in both session stores", async () => {
    const user = await seedUnprovenAccountWithPassword();
    const squatterCookie = sessionTokenCookie(await signIn(ATTACKER_PASSWORD));
    expect(await auth.api.getSession({ headers: { cookie: squatterCookie } })).not.toBeNull();

    await runRecovery(user, await createRecoverySession(user.id));

    // `getSession` reads Redis first, so this is the assertion a raw `prisma.session.deleteMany()` would
    // fail: it would clear the row and leave the session perfectly valid here.
    expect(await auth.api.getSession({ headers: { cookie: squatterCookie } })).toBeNull();
  });

  /**
   * Binds the seam the route relies on and nothing else exercises live: `route.ts` derives
   * `keepSessionToken` from the request cookie via `getSessionTokenFromCookieHeader`, and the sweep
   * compares it against `Session.sessionToken` rows. Better Auth signs its cookie as
   * `token.signature` — if the helper ever returned the signed form (or the secret resolution drifted
   * from auth.ts's), the filter would match nothing and recovery would sign its own caller out.
   */
  test("the route's cookie-derived keep-token matches the stored session token", async () => {
    const user = await seedUnprovenAccountWithPassword();
    const cookie = sessionTokenCookie(await signIn(ATTACKER_PASSWORD));

    const keepToken = getSessionTokenFromCookieHeader(cookie);

    expect(keepToken).toBeTruthy();
    const stored = await prisma.session.findMany({
      where: { userId: user.id },
      select: { sessionToken: true },
    });
    expect(stored.map((row) => row.sessionToken)).toContain(keepToken);
  });

  test("the recovering user's own session is spared, so the redirect stays signed in", async () => {
    const user = await seedUnprovenAccountWithPassword();
    await signIn(ATTACKER_PASSWORD); // a second session, to be swept
    const recoverySessionToken = await createRecoverySession(user.id);

    await runRecovery(user, recoverySessionToken);

    const remaining = await prisma.session.findMany({ where: { userId: user.id } });
    expect(remaining.map((session) => session.sessionToken)).toEqual([recoverySessionToken]);
  });

  /**
   * Recovery flips `identityProvider` to the SSO provider and nothing ever flips it back, so without this
   * the fix would trade a takeover for a lockout: no password, and no way to ask for one.
   */
  test("a recovered user can still get a password back", async () => {
    const user = await seedUnprovenAccountWithPassword();
    await enrollTwoFactor(user.id);

    await runRecovery(user, await createRecoverySession(user.id));

    // The credential row survives with a null password — that row is what identifies them as a password
    // user to `forgotPasswordAction` after `identityProvider` has moved on.
    const credential = await prisma.account.findFirstOrThrow({
      where: { userId: user.id, provider: "credential" },
    });
    expect(credential.password).toBeNull();

    await auth.api.requestPasswordReset({
      body: { email: VICTIM_EMAIL, redirectTo: `${WEBAPP_URL}/auth/forgot-password/reset` },
    });
    const [{ verifyLink }] = vi.mocked(sendPasswordResetLinkEmail).mock.calls.at(-1)!;
    // Better Auth builds `${baseURL}/reset-password/${token}?callbackURL=…`, so the token is a path
    // segment — reading it as a query param yields null and the reset below would fail as unauthenticated.
    const token = new URL(verifyLink).pathname.split("/").pop();
    expect(token).toBeTruthy();

    const newPassword = "Passw0rd!rightful-owner";
    await auth.api.resetPassword({ body: { newPassword, token: token! } });

    expect((await signIn(newPassword)).status).toBe(200);
    expect((await signIn(ATTACKER_PASSWORD)).status).toBe(401);

    // The resurrection channel: that successful credential sign-in is exactly when the backfill shim
    // (`better-auth-two-factor-backfill`) would rebuild a `TwoFactor` row from the legacy `User` columns.
    // Recovery cleared both halves — the row AND the legacy columns — so nothing may come back. This is
    // the assertion that goes red if a refactor ever drops the "redundant" legacy nulls from the strip.
    expect(await prisma.twoFactor.count({ where: { userId: user.id } })).toBe(0);
  });

  test("an already-proven account keeps its password, sessions and 2FA", async () => {
    const user = await seedUnprovenAccountWithPassword();
    await prisma.user.update({ where: { id: user.id }, data: { emailVerified: true } });
    // Mint the owner's session BEFORE enrolling 2FA — after enrolment, `signIn` answers with a 2FA
    // challenge instead of a session cookie.
    const ownerCookie = sessionTokenCookie(await signIn(ATTACKER_PASSWORD));
    expect(await auth.api.getSession({ headers: { cookie: ownerCookie } })).not.toBeNull();
    await enrollTwoFactor(user.id);

    await runRecovery(user, await createRecoverySession(user.id));

    // Linking another provider to a legitimate account must not strip it or sign it out everywhere.
    // With 2FA enrolled, a correct password now yields the challenge (still 200; a stripped password
    // would 401 before the 2FA hook runs), so the 200 proves the credential survived.
    expect((await signIn(ATTACKER_PASSWORD)).status).toBe(200);
    expect(await auth.api.getSession({ headers: { cookie: ownerCookie } })).not.toBeNull();
    expect(await prisma.twoFactor.count({ where: { userId: user.id } })).toBe(1);
    const after = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(after.twoFactorEnabled).toBe(true);
  });
});
