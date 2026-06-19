import { authenticator } from "otplib";
import { beforeEach, describe, expect, test } from "vitest";
import { prisma } from "@formbricks/database";
import { resetDb } from "@/integration/reset-db";
import { auth } from "@/modules/auth/lib/auth";

/**
 * Integration coverage for two-factor auth (ENG-1054, Phase 4) against a real Postgres — drives BA's
 * twoFactor plugin (TOTP) end-to-end: enabling + verifying a secret (TwoFactor table + User.twoFactorEnabled),
 * and that an enabled second factor GATES sign-in (password alone yields a challenge, TOTP completes it).
 */
const allCookies = (res: Response): string =>
  res.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .join("; ");

const secretFromUri = (uri: string): string => /[?&]secret=([^&]+)/.exec(uri)?.[1] ?? "";

const totp = (secret: string): string => {
  authenticator.options = { digits: 6, step: 30 }; // matches auth.ts totpOptions
  return authenticator.generate(secret);
};

const createVerifiedUser = async (email: string, password: string): Promise<string> => {
  await auth.api.signUpEmail({ body: { email, password, name: "Tfa" }, asResponse: true });
  const user = await prisma.user.update({ where: { email }, data: { emailVerified: true } });
  return user.id;
};

const sessionCookie = async (email: string, password: string): Promise<string> => {
  const res = await auth.api.signInEmail({ body: { email, password }, asResponse: true });
  return allCookies(res);
};

beforeEach(async () => {
  await resetDb();
});

describe("Better Auth two-factor (real Postgres)", () => {
  test("enabling 2FA + verifying a TOTP flips twoFactorEnabled and stores the secret", async () => {
    const userId = await createVerifiedUser("tfa@example.com", "Passw0rd!");
    const cookie = await sessionCookie("tfa@example.com", "Passw0rd!");

    const { totpURI } = await auth.api.enableTwoFactor({
      body: { password: "Passw0rd!" },
      headers: { cookie },
    });
    expect(totpURI).toContain("otpauth://");

    await auth.api.verifyTOTP({ body: { code: totp(secretFromUri(totpURI)) }, headers: { cookie } });

    const user = await prisma.user.findUnique({ where: { id: userId }, include: { twoFactors: true } });
    expect(user?.twoFactorEnabled).toBe(true);
    expect(user?.twoFactors).toHaveLength(1);
  });

  test("an enabled second factor gates sign-in: password yields a challenge, TOTP issues the session", async () => {
    await createVerifiedUser("login2fa@example.com", "Passw0rd!");
    const enrollCookie = await sessionCookie("login2fa@example.com", "Passw0rd!");
    const { totpURI } = await auth.api.enableTwoFactor({
      body: { password: "Passw0rd!" },
      headers: { cookie: enrollCookie },
    });
    const secret = secretFromUri(totpURI);
    await auth.api.verifyTOTP({ body: { code: totp(secret) }, headers: { cookie: enrollCookie } });
    await prisma.session.deleteMany(); // clear the enrollment session

    // password-only sign-in returns a 2FA challenge (a 200, not an error) — but no full session yet
    const challenge = await auth.api.signInEmail({
      body: { email: "login2fa@example.com", password: "Passw0rd!" },
      asResponse: true,
    });
    expect(challenge.status).toBe(200);
    expect(await prisma.session.count()).toBe(0);

    // completing the TOTP challenge issues the session
    await auth.api.verifyTOTP({ body: { code: totp(secret) }, headers: { cookie: allCookies(challenge) } });
    expect(await prisma.session.count()).toBe(1);
  });
});
