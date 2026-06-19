import { authenticator } from "otplib";
import { beforeEach, describe, expect, test } from "vitest";
import { prisma } from "@formbricks/database";
import { resetDb } from "@/integration/reset-db";
import { ENCRYPTION_KEY } from "@/lib/constants";
import { hashSecret, symmetricEncrypt } from "@/lib/crypto";
import { auth } from "@/modules/auth/lib/auth";
import {
  reencodeAllTwoFactorSecrets,
  reencodeTwoFactorBackupCodes,
  reencodeTwoFactorSecret,
} from "@/modules/auth/lib/cutover/reencode-two-factor";

/**
 * Integration coverage for the cutover 2FA secret re-encode (ENG-1054, spike S3) against real Postgres.
 * Proves the cutover guarantee: an existing NextAuth-era 2FA user keeps their authenticator app — their
 * CURRENT TOTP code verifies via Better Auth after the secret is re-encoded into BA's TwoFactor table.
 */
const allCookies = (res: Response): string =>
  res.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .join("; ");

beforeEach(async () => {
  await resetDb();
});

describe("2FA secret re-encode (real Postgres)", () => {
  test("an existing NextAuth-era 2FA user verifies their current authenticator code via BA after re-encode", async () => {
    authenticator.options = { digits: 6, step: 30 };
    const password = "TwoFa-User1!";
    const fbSecret = authenticator.generateSecret(20); // the secret the user's authenticator already holds

    // NextAuth-era 2FA user: otplib secret + backup codes encrypted with ENCRYPTION_KEY, 2FA enabled
    const user = await prisma.user.create({
      data: {
        email: "tfa-legacy@example.com",
        name: "TfaLegacy",
        emailVerified: true,
        password: await hashSecret(password),
        twoFactorEnabled: true,
        twoFactorSecret: symmetricEncrypt(fbSecret, ENCRYPTION_KEY),
        backupCodes: symmetricEncrypt(JSON.stringify(["aaaaabbbbb", "cccccddddd"]), ENCRYPTION_KEY),
      },
    });
    // credential account (the credential-backfill's job) so the password step works
    await prisma.account.create({
      data: {
        userId: user.id,
        type: "credential",
        provider: "credential",
        providerAccountId: user.id,
        password: user.password!,
      },
    });

    // re-encode the secret + backup codes into BA's TwoFactor table, using BA's secretConfig
    const secretConfig = (await auth.$context).secretConfig as string;
    await prisma.twoFactor.create({
      data: {
        userId: user.id,
        secret: await reencodeTwoFactorSecret(user.twoFactorSecret!, secretConfig),
        backupCodes: await reencodeTwoFactorBackupCodes(user.backupCodes!, secretConfig),
      },
    });

    // password sign-in returns a 2FA challenge (no session yet)
    const challenge = await auth.api.signInEmail({
      body: { email: "tfa-legacy@example.com", password },
      asResponse: true,
    });
    expect(challenge.status).toBe(200);
    expect(await prisma.session.count()).toBe(0);

    // the user's CURRENT authenticator code (from the original Formbricks secret) completes the challenge
    await auth.api.verifyTOTP({
      body: { code: authenticator.generate(fbSecret) },
      headers: { cookie: allCookies(challenge) },
    });
    expect(await prisma.session.count()).toBe(1);
  });

  test("batch re-encode migrates every legacy 2FA user and is idempotent", async () => {
    authenticator.options = { digits: 6, step: 30 };
    const fbSecret = authenticator.generateSecret(20);
    const user = await prisma.user.create({
      data: {
        email: "tfa-batch@example.com",
        name: "Batch",
        emailVerified: true,
        twoFactorEnabled: true,
        twoFactorSecret: symmetricEncrypt(fbSecret, ENCRYPTION_KEY),
        backupCodes: symmetricEncrypt(JSON.stringify(["zzzzzwwwww"]), ENCRYPTION_KEY),
      },
    });
    const secretConfig = (await auth.$context).secretConfig as string;

    const first = await reencodeAllTwoFactorSecrets(secretConfig);
    expect(first.migrated).toBe(1);
    expect(await prisma.twoFactor.count({ where: { userId: user.id } })).toBe(1);

    // re-running skips the already-migrated user (idempotent), creating no duplicate row
    const second = await reencodeAllTwoFactorSecrets(secretConfig);
    expect(second.migrated).toBe(0);
    expect(second.skipped).toBe(1);
    expect(await prisma.twoFactor.count({ where: { userId: user.id } })).toBe(1);
  });
});
