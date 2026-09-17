import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { resetDb } from "@/integration/reset-db";
import {
  ACCOUNT_DELETED_PATH,
  FORMBRICKS_CLOUD_ACCOUNT_DELETION_SURVEY_URL,
} from "@/modules/account/constants";
import { auth } from "@/modules/auth/lib/auth";
import { sendDeleteAccountConfirmationEmail } from "@/modules/email";
import { requestSsoAccountDeletionEmail } from "./better-auth-account-deletion-request";

// getSession is NextAuth-backed (the Phase 2 DAL) and can't read the Better Auth cookie this harness
// mints, so stub it to return the seeded requester. The verification-value mint + native callback
// (the parts actually under test) run against the real Postgres untouched.
const { getSessionMock } = vi.hoisted(() => ({ getSessionMock: vi.fn() }));
vi.mock("@/modules/auth/lib/session", () => ({ getSession: getSessionMock }));

// Toggle IS_FORMBRICKS_CLOUD per test to cover both post-deletion redirect targets; every other
// constant (WEBAPP_URL, etc.) stays real so the Better Auth harness is untouched (auth.ts does not
// read IS_FORMBRICKS_CLOUD).
const { constantsOverrides } = vi.hoisted(() => ({ constantsOverrides: { isFormbricksCloud: false } }));
vi.mock("@/lib/constants", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/constants")>();
  return {
    ...actual,
    get IS_FORMBRICKS_CLOUD() {
      return constantsOverrides.isFormbricksCloud;
    },
  };
});

// @/modules/email is mocked in integration/setup.ts (captures mail instead of hitting SMTP); grab the
// auto-mocked sendDeleteAccountConfirmationEmail to assert the action calls it with the callback link.
const sendDeleteAccountConfirmationEmailMock = vi.mocked(sendDeleteAccountConfirmationEmail);

/**
 * Integration coverage for the SSO account-deletion email-link request (ENG-1054, design doc §14)
 * against a real Postgres. The action mints a `delete-account-<token>` verification value carrying the
 * requester's id and emails Better Auth's native `GET /delete-user/callback` link; this test then
 * drives that callback (the proven path in better-auth-account-deletion.integration.test.ts) to prove
 * the minted value actually deletes the user — no password supplied (the SSO half of §14).
 */
const signInCookie = async (email: string, password: string): Promise<string> => {
  const res = await auth.api.signInEmail({ body: { email, password }, asResponse: true });
  const cookies = res.headers.getSetCookie();
  const session = cookies.find((c) => c.includes("session_token"));
  if (!session) throw new Error(`no session cookie in sign-in response (got: ${cookies.join(", ")})`);
  return session.split(";")[0]; // name=value, dropping attributes
};

const createVerifiedUser = async (email: string, password: string): Promise<string> => {
  await auth.api.signUpEmail({ body: { email, password, name: "Del" }, asResponse: true });
  const user = await prisma.user.update({ where: { email }, data: { emailVerified: true } });
  return user.id;
};

beforeEach(async () => {
  await resetDb();
  vi.clearAllMocks();
  constantsOverrides.isFormbricksCloud = false;
});

describe("requestSsoAccountDeletionEmail (real Postgres)", () => {
  test("throws when there is no authenticated session", async () => {
    getSessionMock.mockResolvedValue(null);

    await expect(requestSsoAccountDeletionEmail()).rejects.toThrow();
    expect(sendDeleteAccountConfirmationEmailMock).not.toHaveBeenCalled();
  });

  test("mints a delete-account verification value, emails the callback link, and the callback deletes the user", async () => {
    const email = "ssorequest@example.com";
    const userId = await createVerifiedUser(email, "Passw0rd!");
    // The email-link path serves password-less SSO users; mark this one accordingly so the guard
    // (credential users must use the password flow) allows it.
    await prisma.user.update({ where: { id: userId }, data: { identityProvider: "google" } });
    const cookie = await signInCookie(email, "Passw0rd!");
    getSessionMock.mockResolvedValue({ user: { id: userId, email } });

    await requestSsoAccountDeletionEmail();

    // The action emailed the Better Auth callback link; the token is carried in the link's query.
    expect(sendDeleteAccountConfirmationEmailMock).toHaveBeenCalledTimes(1);
    const mailArgs = sendDeleteAccountConfirmationEmailMock.mock.calls[0][0];
    expect(mailArgs.email).toBe(email);
    expect(mailArgs.deleteLink).toContain("/api/auth/delete-user/callback?token=");
    // The callback returns to the post-deletion page, which is where the deployment-specific hop
    // happens (ENG-3260).
    expect(mailArgs.deleteLink).toContain(`callbackURL=${encodeURIComponent(ACCOUNT_DELETED_PATH)}`);
    const token = new URL(mailArgs.deleteLink).searchParams.get("token");
    expect(token).toBeTruthy();

    // A `delete-account-<token>` verification value was created carrying the user's id (value === user
    // id) — the exact shape Better Auth's deleteUserCallback verifies against the session user.
    const ctx = await auth.$context;
    const deleteVerification = await ctx.internalAdapter.findVerificationValue(`delete-account-${token}`);
    expect(deleteVerification).toBeDefined();
    expect(deleteVerification?.value).toBe(userId);

    // Drive Better Auth's native callback with the minted token + the requester's session: it verifies
    // value === session.user.id and deletes the user (no password — the SSO email-link path).
    await auth.api.deleteUserCallback({
      query: { token: token as string, callbackURL: "/" },
      headers: { cookie },
      asResponse: true,
    });

    expect(await prisma.user.findUnique({ where: { id: userId } })).toBeNull();
  });

  test("on Formbricks Cloud, the emailed link still carries a relative callbackURL (ENG-3260)", async () => {
    constantsOverrides.isFormbricksCloud = true;
    const email = "ssocloud@example.com";
    const userId = await createVerifiedUser(email, "Passw0rd!");
    await prisma.user.update({ where: { id: userId }, data: { identityProvider: "google" } });
    getSessionMock.mockResolvedValue({ user: { id: userId, email } });

    await requestSsoAccountDeletionEmail();

    expect(sendDeleteAccountConfirmationEmailMock).toHaveBeenCalledTimes(1);
    const mailArgs = sendDeleteAccountConfirmationEmailMock.mock.calls[0][0];
    // The Cloud flag must not change the callbackURL: the offboarding survey is reached from the
    // /auth/account-deleted page in the browser, never through Better Auth's origin-checked redirect.
    expect(mailArgs.deleteLink).toContain(`callbackURL=${encodeURIComponent(ACCOUNT_DELETED_PATH)}`);
    expect(mailArgs.deleteLink).not.toContain(
      encodeURIComponent(FORMBRICKS_CLOUD_ACCOUNT_DELETION_SURVEY_URL)
    );
  });

  /**
   * The bug lived in Better Auth's HTTP middleware, not in the string this module returns, so these two
   * drive the REAL handler over a REAL Request. Two things make that work, and neither is optional:
   *
   *  1. `auth.handler(new Request(...))`, never `auth.api.deleteUserCallback({ query, headers })`.
   *     `originCheck` opens with `if (!ctx.request) return`
   *     (better-auth/dist/api/middlewares/origin-check.mjs), and the direct `auth.api.*` call carries
   *     headers but no Request — so the gate never runs and the call succeeds with the bug fully present.
   *  2. `withOriginCheck`. Better Auth disables the gate outright under NODE_ENV=test
   *     (`skipOriginCheck: … isTest() ? true : false`, context/create-context.mjs), which is every
   *     vitest run, so even a real Request sails through. Re-arming it restores the production
   *     behaviour on the real `auth` instance and its real `trustedOrigins`.
   *
   * Between them, a test written the obvious way is green before and after the fix. The negative
   * control is what keeps this honest: it proves the gate really is armed here, so the positive test's
   * 302 means something.
   */
  const withOriginCheck = async <T>(run: () => Promise<T>): Promise<T> => {
    const ctx = await auth.$context;
    const previous = ctx.skipOriginCheck;
    ctx.skipOriginCheck = false;
    try {
      return await run();
    } finally {
      ctx.skipOriginCheck = previous;
    }
  };

  const requestDeleteLinkFor = async (email: string): Promise<{ deleteLink: string; userId: string }> => {
    const userId = await createVerifiedUser(email, "Passw0rd!");
    await prisma.user.update({ where: { id: userId }, data: { identityProvider: "google" } });
    getSessionMock.mockResolvedValue({ user: { id: userId, email } });

    await requestSsoAccountDeletionEmail();

    return { deleteLink: sendDeleteAccountConfirmationEmailMock.mock.calls[0][0].deleteLink, userId };
  };

  test("the emailed link survives originCheck end to end on a Cloud deployment and deletes the user", async () => {
    constantsOverrides.isFormbricksCloud = true;
    const email = "ssocloudhttp@example.com";
    const { deleteLink, userId } = await requestDeleteLinkFor(email);
    const cookie = await signInCookie(email, "Passw0rd!");

    // Exactly what clicking the link in the inbox does.
    const response = await withOriginCheck(() =>
      auth.handler(new Request(deleteLink, { headers: { cookie } }))
    );

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe(ACCOUNT_DELETED_PATH);
    expect(await prisma.user.findUnique({ where: { id: userId } })).toBeNull();
  });

  test("negative control: an absolute, cross-origin callbackURL is rejected before the token is read", async () => {
    const email = "ssocrossorigin@example.com";
    const { deleteLink, userId } = await requestDeleteLinkFor(email);
    const cookie = await signInCookie(email, "Passw0rd!");

    // Swap in the hardcoded Cloud survey URL the old code sent — the staging failure, byte for byte.
    const crossOriginLink = deleteLink.replace(
      `callbackURL=${encodeURIComponent(ACCOUNT_DELETED_PATH)}`,
      `callbackURL=${encodeURIComponent(FORMBRICKS_CLOUD_ACCOUNT_DELETION_SURVEY_URL)}`
    );
    const response = await withOriginCheck(() =>
      auth.handler(new Request(crossOriginLink, { headers: { cookie } }))
    );

    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ code: "INVALID_CALLBACK_URL" });
    // And the account survives — which is what made account deletion untestable on staging.
    expect(await prisma.user.findUnique({ where: { id: userId } })).not.toBeNull();
  });

  test("rejects a credential (email-identity) user — they must confirm with their password", async () => {
    const email = "credrequest@example.com";
    const userId = await createVerifiedUser(email, "Passw0rd!"); // identityProvider defaults to "email"
    getSessionMock.mockResolvedValue({ user: { id: userId, email } });

    // Spy on the token mint to prove no delete-account verification value is ever created — not just
    // that no email was sent. A future refactor could mint before throwing, leaving a live delete token
    // the callback would honor; this keeps that regression visible.
    const ctx = await auth.$context;
    const mintSpy = vi.spyOn(ctx.internalAdapter, "createVerificationValue");

    // A directly-called server action must not let a credential user take the SSO email-link path.
    await expect(requestSsoAccountDeletionEmail()).rejects.toThrow(/password confirmation/i);
    expect(mintSpy).not.toHaveBeenCalled(); // no delete-account token minted
    expect(sendDeleteAccountConfirmationEmailMock).not.toHaveBeenCalled(); // and no email sent
    expect(await prisma.user.findUnique({ where: { id: userId } })).not.toBeNull(); // user untouched

    mintSpy.mockRestore();
  });
});
