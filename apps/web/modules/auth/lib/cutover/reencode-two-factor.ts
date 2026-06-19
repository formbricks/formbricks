import "server-only";
import { base32 } from "@better-auth/utils/base32";
import { symmetricEncrypt } from "better-auth/crypto";
import { prisma } from "@formbricks/database";
import { ENCRYPTION_KEY } from "@/lib/constants";
import { symmetricDecrypt } from "@/lib/crypto";

/**
 * Re-encode a NextAuth-era 2FA secret + backup codes into Better Auth's TwoFactor format (ENG-1054,
 * spike S3) so existing users keep their authenticator app at cutover — no re-enrollment.
 *
 * NextAuth/otplib stored the TOTP secret as a base32 string (`twoFactorSecret`), encrypted with
 * `ENCRYPTION_KEY` (AES-GCM, lib/crypto.ts), and HMACs base32-decode(secret). Better Auth stores the
 * RAW key bytes (encrypted with its own `secretConfig`) and HMACs those bytes directly. So the bridge
 * is: decrypt with ENCRYPTION_KEY → base32-decode to the raw key → re-encrypt with BA's secretConfig.
 * Empirically validated end-to-end (the user's current authenticator code verifies via BA) by
 * reencode-two-factor.integration.test.ts.
 *
 * `secretConfig` comes from `(await auth.$context).secretConfig` (the BA secret, or rotation config).
 * These run at the cutover deploy; the per-user functions are pure so they're harness-testable.
 */
export const reencodeTwoFactorSecret = async (
  encryptedFormbricksSecret: string,
  secretConfig: string
): Promise<string> => {
  const formbricksSecret = symmetricDecrypt(encryptedFormbricksSecret, ENCRYPTION_KEY); // otplib base32
  const keyBytes = Buffer.from(base32.decode(formbricksSecret));
  return symmetricEncrypt({ key: secretConfig, data: keyBytes.toString("latin1") });
};

/**
 * Re-encrypt the backup codes from the Formbricks envelope (a JSON array of codes, AES-GCM with
 * ENCRYPTION_KEY) into Better Auth's envelope (the same JSON array, encrypted with secretConfig).
 */
export const reencodeTwoFactorBackupCodes = async (
  encryptedFormbricksBackupCodes: string,
  secretConfig: string
): Promise<string> => {
  const codes = JSON.parse(symmetricDecrypt(encryptedFormbricksBackupCodes, ENCRYPTION_KEY)) as string[];
  return symmetricEncrypt({ key: secretConfig, data: JSON.stringify(codes) });
};

/**
 * Batch re-encode for the cutover deploy: create a Better Auth TwoFactor row for every legacy 2FA user
 * (those with a `User.twoFactorSecret`). Idempotent — skips users who already have a TwoFactor row.
 * Run from a cutover script that supplies `secretConfig = (await auth.$context).secretConfig`. A user
 * with a secret but no stored backup codes gets an empty (encrypted) code list.
 */
interface TwoFactorUserRow {
  id: string;
  twoFactorSecret: string;
  backupCodes: string | null;
}

export const reencodeAllTwoFactorSecrets = async (
  secretConfig: string
): Promise<{ scanned: number; migrated: number; skipped: number }> => {
  const stats = { scanned: 0, migrated: 0, skipped: 0 };
  const BATCH_SIZE = 500;

  // Keyset pagination via raw SQL (avoids Prisma's relation-select inference quirk); the idempotency
  // check is a separate findFirst since TwoFactor has no unique key to ON CONFLICT on.
  const fetchBatch = (afterUserId: string | null): Promise<TwoFactorUserRow[]> =>
    afterUserId
      ? prisma.$queryRaw<TwoFactorUserRow[]>`
          SELECT "id", "twoFactorSecret", "backupCodes" FROM "User"
          WHERE "twoFactorSecret" IS NOT NULL AND "id" > ${afterUserId}
          ORDER BY "id" ASC LIMIT ${BATCH_SIZE}`
      : prisma.$queryRaw<TwoFactorUserRow[]>`
          SELECT "id", "twoFactorSecret", "backupCodes" FROM "User"
          WHERE "twoFactorSecret" IS NOT NULL
          ORDER BY "id" ASC LIMIT ${BATCH_SIZE}`;

  let lastUserId: string | null = null;
  for (;;) {
    const users = await fetchBatch(lastUserId);
    if (users.length === 0) break;
    stats.scanned += users.length;

    for (const user of users) {
      const existing = await prisma.twoFactor.findFirst({ where: { userId: user.id }, select: { id: true } });
      if (existing) {
        stats.skipped += 1; // already migrated (idempotent re-run)
        continue;
      }
      await prisma.twoFactor.create({
        data: {
          userId: user.id,
          secret: await reencodeTwoFactorSecret(user.twoFactorSecret, secretConfig),
          backupCodes: user.backupCodes
            ? await reencodeTwoFactorBackupCodes(user.backupCodes, secretConfig)
            : await symmetricEncrypt({ key: secretConfig, data: "[]" }),
        },
      });
      stats.migrated += 1;
    }
    lastUserId = users[users.length - 1].id;
  }

  return stats;
};
