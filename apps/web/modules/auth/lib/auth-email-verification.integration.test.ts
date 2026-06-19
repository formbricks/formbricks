import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { resetDb } from "@/integration/reset-db";
import { auth } from "@/modules/auth/lib/auth";
import { sendPasswordResetLinkEmail, sendVerificationLinkEmail } from "@/modules/email";

/**
 * Integration coverage for email verification + password reset (ENG-1054) against a real Postgres.
 * Exercises the Better Auth email callbacks (which reuse the Formbricks mailer — captured here): the
 * single-use password-reset token (getAndDelete), the bcrypt re-hash + revokeSessionsOnPasswordReset on
 * reset, and the idempotent stateless-JWT verify-email.
 */

// Verification links are query-form (/verify-email?token=…); reset links are path-form
// (/reset-password/<token>?callbackURL=…). Handle both.
const tokenFromLink = (link: string): string => {
  const url = new URL(link);
  return url.searchParams.get("token") ?? url.pathname.split("/").filter(Boolean).pop() ?? "";
};

beforeEach(async () => {
  await resetDb();
  vi.clearAllMocks();
});

describe("Better Auth email verification (real Postgres)", () => {
  test("sign-up sends a verification link; consuming it flips emailVerified to true", async () => {
    await auth.api.signUpEmail({
      body: { email: "verify@example.com", password: "Passw0rd!", name: "Vera" },
      asResponse: true,
    });
    expect((await prisma.user.findUnique({ where: { email: "verify@example.com" } }))?.emailVerified).toBe(
      false
    );

    expect(sendVerificationLinkEmail).toHaveBeenCalledTimes(1);
    const token = tokenFromLink(vi.mocked(sendVerificationLinkEmail).mock.calls[0][0].verifyLink);
    expect(token).toBeTruthy();

    await auth.api.verifyEmail({ query: { token } });

    expect((await prisma.user.findUnique({ where: { email: "verify@example.com" } }))?.emailVerified).toBe(
      true
    );

    // verify-email is a stateless signed JWT (no getAndDelete), so re-verifying is idempotent:
    // the already-verified branch returns { status: true, user: null }
    const replay = await auth.api.verifyEmail({ query: { token } });
    expect(replay).toMatchObject({ status: true, user: null });
  });
});

describe("Better Auth password reset (real Postgres)", () => {
  test("reset re-hashes the password, revokes sessions, and invalidates the old credentials", async () => {
    await auth.api.signUpEmail({
      body: { email: "reset@example.com", password: "OldPassw0rd!", name: "Rhea" },
      asResponse: true,
    });
    await prisma.user.update({ where: { email: "reset@example.com" }, data: { emailVerified: true } });

    // establish a live session so we can assert it gets revoked
    await auth.api.signInEmail({
      body: { email: "reset@example.com", password: "OldPassw0rd!" },
      asResponse: true,
    });
    expect(await prisma.session.count()).toBe(1);

    await auth.api.requestPasswordReset({ body: { email: "reset@example.com", redirectTo: "/" } });
    expect(sendPasswordResetLinkEmail).toHaveBeenCalledTimes(1);
    const token = tokenFromLink(vi.mocked(sendPasswordResetLinkEmail).mock.calls[0][0].verifyLink);
    expect(token).toBeTruthy();

    await auth.api.resetPassword({ body: { token, newPassword: "NewPassw0rd!" } });

    // the reset token is single-use (consumed via getAndDelete) — replaying it fails
    await expect(auth.api.resetPassword({ body: { token, newPassword: "Another1!" } })).rejects.toBeTruthy();

    // sessions revoked on reset (revokeSessionsOnPasswordReset)
    expect(await prisma.session.count()).toBe(0);
    // old password no longer works
    await expect(
      auth.api.signInEmail({ body: { email: "reset@example.com", password: "OldPassw0rd!" } })
    ).rejects.toBeTruthy();
    // new password works
    const ok = await auth.api.signInEmail({
      body: { email: "reset@example.com", password: "NewPassw0rd!" },
      asResponse: true,
    });
    expect(ok.status).toBe(200);
  });
});
