import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { resetDb } from "@/integration/reset-db";
import { auth } from "@/modules/auth/lib/auth";
import { sendDeleteAccountConfirmationEmail } from "@/modules/email";
import { requestSsoAccountDeletionEmail } from "./better-auth-account-deletion-request";

// getSession is NextAuth-backed (the Phase 2 DAL) and can't read the Better Auth cookie this harness
// mints, so stub it to return the seeded requester. The verification-value mint + native callback
// (the parts actually under test) run against the real Postgres untouched.
const { getSessionMock } = vi.hoisted(() => ({ getSessionMock: vi.fn() }));
vi.mock("@/modules/auth/lib/session", () => ({ getSession: getSessionMock }));

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
    expect(mailArgs.deleteLink).toContain("callbackURL=/");
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

  test("rejects a credential (email-identity) user — they must confirm with their password", async () => {
    const email = "credrequest@example.com";
    const userId = await createVerifiedUser(email, "Passw0rd!"); // identityProvider defaults to "email"
    getSessionMock.mockResolvedValue({ user: { id: userId, email } });

    // A directly-called server action must not let a credential user take the SSO email-link path.
    await expect(requestSsoAccountDeletionEmail()).rejects.toThrow(/password confirmation/i);
    expect(sendDeleteAccountConfirmationEmailMock).not.toHaveBeenCalled(); // rejected before minting/emailing
    expect(await prisma.user.findUnique({ where: { id: userId } })).not.toBeNull(); // user untouched
  });
});
