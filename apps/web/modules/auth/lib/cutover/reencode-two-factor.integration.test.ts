import { authenticator } from "otplib";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
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

// authenticator.options is process-global; a test that mutates it must restore the defaults so it
// can't make later tests order-dependent.
const defaultAuthenticatorOptions = { ...authenticator.options };

beforeEach(async () => {
  await resetDb();
});

afterEach(() => {
  authenticator.options = defaultAuthenticatorOptions;
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
    const secretConfig = (await auth.$context).secretConfig;
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

  test("an existing user's saved (hyphenated) backup code verifies via BA after re-encode", async () => {
    const password = "Backup-User1!";
    const fbSecret = authenticator.generateSecret(20);
    // legacy backup codes are stored bare (10-char hex); the user saved the displayed hyphenated form
    const bareCodes = ["a1b2c3d4e5", "0f1e2d3c4b"];
    const user = await prisma.user.create({
      data: {
        email: "tfa-backup@example.com",
        name: "TfaBackup",
        emailVerified: true,
        password: await hashSecret(password),
        twoFactorEnabled: true,
        twoFactorSecret: symmetricEncrypt(fbSecret, ENCRYPTION_KEY),
        backupCodes: symmetricEncrypt(JSON.stringify(bareCodes), ENCRYPTION_KEY),
      },
    });
    await prisma.account.create({
      data: {
        userId: user.id,
        type: "credential",
        provider: "credential",
        providerAccountId: user.id,
        password: user.password!,
      },
    });

    const secretConfig = (await auth.$context).secretConfig;
    await prisma.twoFactor.create({
      data: {
        userId: user.id,
        secret: await reencodeTwoFactorSecret(user.twoFactorSecret!, secretConfig),
        backupCodes: await reencodeTwoFactorBackupCodes(user.backupCodes!, secretConfig),
      },
    });

    const challenge = await auth.api.signInEmail({
      body: { email: "tfa-backup@example.com", password },
      asResponse: true,
    });
    expect(challenge.status).toBe(200);
    expect(await prisma.session.count()).toBe(0);

    // the user enters their SAVED backup code (the displayed hyphenated form); BA exact-matches it
    await auth.api.verifyBackupCode({
      body: { code: "a1b2c-3d4e5" },
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
    const secretConfig = (await auth.$context).secretConfig;

    const first = await reencodeAllTwoFactorSecrets(secretConfig);
    expect(first.migrated).toBe(1);
    expect(await prisma.twoFactor.count({ where: { userId: user.id } })).toBe(1);

    // re-running skips the already-migrated user (idempotent), creating no duplicate row
    const second = await reencodeAllTwoFactorSecrets(secretConfig);
    expect(second.migrated).toBe(0);
    expect(second.skipped).toBe(1);
    expect(await prisma.twoFactor.count({ where: { userId: user.id } })).toBe(1);
  });

  // ENG-1824: a user enrolled on the legacy flow has 2FA + a legacy backup code but NO `TwoFactor`
  // row. On their next password sign-in the self-heal must materialize the row from their EXISTING
  // (older) secret + backup codes — no migration run, no re-enrollment — so one of the codes they
  // saved back then still verifies. Drives the real `hooks.after` heal (not a hand-written row) and
  // the real BA verify-backup-code, end to end.
  test("a legacy 2FA user's OLD backup code verifies after the sign-in self-heal (no pre-existing row)", async () => {
    authenticator.options = { digits: 6, step: 30 };
    const password = "Legacy-Heal1!";
    const fbSecret = authenticator.generateSecret(20);
    // Codes as the legacy setup stored them: bare 10-char hex, encrypted with ENCRYPTION_KEY.
    const bareCodes = ["a1b2c3d4e5", "0f1e2d3c4b"];
    const user = await prisma.user.create({
      data: {
        email: "legacy-heal-backup@example.com",
        name: "LegacyHealBackup",
        emailVerified: true,
        password: await hashSecret(password),
        twoFactorEnabled: true,
        twoFactorSecret: symmetricEncrypt(fbSecret, ENCRYPTION_KEY),
        backupCodes: symmetricEncrypt(JSON.stringify(bareCodes), ENCRYPTION_KEY),
      },
    });
    await prisma.account.create({
      data: {
        userId: user.id,
        type: "credential",
        provider: "credential",
        providerAccountId: user.id,
        password: user.password!,
      },
    });

    // No TwoFactor row yet — the heal is the only thing that can create it.
    expect(await prisma.twoFactor.count({ where: { userId: user.id } })).toBe(0);

    // Password step: BA returns the 2FA challenge (no session yet) and the after-hook heal runs.
    const challenge = await auth.api.signInEmail({
      body: { email: "legacy-heal-backup@example.com", password },
      asResponse: true,
    });
    expect(challenge.status).toBe(200);
    expect(await prisma.session.count()).toBe(0);

    // The heal materialized a verified row from the legacy columns.
    const healed = await prisma.twoFactor.findUnique({ where: { userId: user.id } });
    expect(healed?.verified).toBe(true);

    // The user enters an OLD backup code in the displayed hyphenated form; BA exact-matches it and
    // promotes the partial session to a full one.
    await auth.api.verifyBackupCode({
      body: { code: "a1b2c-3d4e5" },
      headers: { cookie: allCookies(challenge) },
    });
    expect(await prisma.session.count()).toBe(1);
  });

  // ENG-1824 regression: the legacy login consumed a used backup code by nulling its slot in place
  // (`backupCodes[i] = null`), so a real upgraded user who ever used one has `null` entries. The heal's
  // re-encode must skip those (not crash on `null.slice(...)`), materialize a row from the REMAINING
  // valid codes, and let one of them verify. Reproduces the actual upgrade failure that "TOTP not
  // enabled" masked.
  test("a legacy 2FA user with a CONSUMED (null) backup code still heals and a remaining code verifies", async () => {
    authenticator.options = { digits: 6, step: 30 };
    const password = "Legacy-Heal2!";
    const fbSecret = authenticator.generateSecret(20);
    // First slot nulled = the code the user already spent on the legacy app; second is still valid.
    const storedCodes = [null, "0f1e2d3c4b"];
    const user = await prisma.user.create({
      data: {
        email: "legacy-consumed-backup@example.com",
        name: "LegacyConsumed",
        emailVerified: true,
        password: await hashSecret(password),
        twoFactorEnabled: true,
        twoFactorSecret: symmetricEncrypt(fbSecret, ENCRYPTION_KEY),
        backupCodes: symmetricEncrypt(JSON.stringify(storedCodes), ENCRYPTION_KEY),
      },
    });
    await prisma.account.create({
      data: {
        userId: user.id,
        type: "credential",
        provider: "credential",
        providerAccountId: user.id,
        password: user.password!,
      },
    });

    expect(await prisma.twoFactor.count({ where: { userId: user.id } })).toBe(0);

    // Sign-in heal must NOT throw on the null slot; it materializes a verified row from the survivors.
    const challenge = await auth.api.signInEmail({
      body: { email: "legacy-consumed-backup@example.com", password },
      asResponse: true,
    });
    expect(challenge.status).toBe(200);
    const healed = await prisma.twoFactor.findUnique({ where: { userId: user.id } });
    expect(healed?.verified).toBe(true);

    // The still-valid code verifies; the consumed one was dropped (not carried over as a broken entry).
    await auth.api.verifyBackupCode({
      body: { code: "0f1e2-d3c4b" },
      headers: { cookie: allCookies(challenge) },
    });
    expect(await prisma.session.count()).toBe(1);
  });
});
