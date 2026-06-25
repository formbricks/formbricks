import "server-only";
import { base32 } from "@better-auth/utils/base32";
import { type SecretConfig, symmetricEncrypt } from "better-auth/crypto";
import { prisma } from "@formbricks/database";
import { ENCRYPTION_KEY } from "@/lib/constants";
import { symmetricDecrypt } from "@/lib/crypto";

/**
 * Re-encode a NextAuth-era 2FA secret + backup codes into Better Auth's TwoFactor format (ENG-1054,
 * spike S3) so existing users keep their authenticator app at cutover — no re-enrollment.
 *
 * NextAuth/otplib stored the TOTP secret as a base32 string (`twoFactorSecret`), encrypted with
 * `ENCRYPTION_KEY` (AES-GCM, lib/crypto.ts), and HMACs base32-decode(secret). Better Auth stores the
 * key bytes (encrypted with its own `secretConfig`) and HMACs `utf8(secretString)` directly. So the
 * bridge is: decrypt with ENCRYPTION_KEY → base32-decode to the key bytes → re-encrypt with secretConfig.
 *
 * Why a latin1 string survives: otplib's `authenticator.generateSecret(20)` ascii-masks its entropy
 * (`randomBytes(20).toString("ascii")`) BEFORE base32-encoding, so `base32.decode` always yields bytes
 * ≤ 0x7F. Within that 7-bit range latin1 and utf8 coincide, so `latin1 → symmetricEncrypt(utf8) →
 * symmetricDecrypt(utf8) → HMAC(utf8)` round-trips byte-exact. This is NOT generically latin1-safe — it
 * holds because `two-factor-auth.ts` is the only writer of `twoFactorSecret` and always uses
 * `generateSecret(20)`. Validated end-to-end (the user's current authenticator code verifies via BA) by
 * reencode-two-factor.integration.test.ts.
 *
 * `secretConfig` comes from `(await auth.$context).secretConfig` (the BA secret string, or — under key
 * rotation — the SecretConfig object). These run at the cutover deploy; the per-user functions are pure
 * so they're harness-testable.
 */
export const reencodeTwoFactorSecret = async (
  encryptedFormbricksSecret: string,
  secretConfig: string | SecretConfig
): Promise<string> => {
  const formbricksSecret = symmetricDecrypt(encryptedFormbricksSecret, ENCRYPTION_KEY); // otplib base32
  const keyBytes = Buffer.from(base32.decode(formbricksSecret));
  return symmetricEncrypt({ key: secretConfig, data: keyBytes.toString("latin1") });
};

/**
 * Re-encode backup codes from the Formbricks envelope (a JSON array, AES-GCM with ENCRYPTION_KEY) into
 * Better Auth's envelope (a JSON array encrypted with secretConfig — matching BA's
 * `storeBackupCodes: "encrypted"`). Formbricks stored bare 10-char hex but DISPLAYED (so users saved)
 * the hyphenated `XXXXX-XXXXX` form (`display-backup-codes.tsx` formatBackupCode), and BA's
 * verify-backup-code does an EXACT match with no hyphen-stripping. So we store the displayed form — the
 * string the user will actually enter.
 */
export const reencodeTwoFactorBackupCodes = async (
  encryptedFormbricksBackupCodes: string,
  secretConfig: string | SecretConfig
): Promise<string> => {
  const bareCodes = JSON.parse(symmetricDecrypt(encryptedFormbricksBackupCodes, ENCRYPTION_KEY)) as string[];
  const displayedCodes = bareCodes.map((code) => `${code.slice(0, 5)}-${code.slice(5, 10)}`);
  return symmetricEncrypt({ key: secretConfig, data: JSON.stringify(displayedCodes) });
};

interface TwoFactorUserRow {
  id: string;
  twoFactorSecret: string;
  backupCodes: string | null;
}

/**
 * Batch re-encode for the cutover deploy: create a Better Auth TwoFactor row for every legacy 2FA user
 * (those with a `User.twoFactorSecret`). Idempotent — skips users who already have a TwoFactor row. Run
 * from a cutover script that supplies `secretConfig = (await auth.$context).secretConfig`. A user with a
 * secret but no stored backup codes gets an empty (encrypted) code list.
 */
export const reencodeAllTwoFactorSecrets = async (
  secretConfig: string | SecretConfig
): Promise<{ scanned: number; migrated: number; skipped: number }> => {
  const stats = { scanned: 0, migrated: 0, skipped: 0 };
  const BATCH_SIZE = 500;

  // Keyset pagination via raw SQL (avoids Prisma's relation-select inference quirk). Idempotency is a
  // per-user findUnique on TwoFactor.userId (now `@@unique`) — safe for this one-shot, single-process
  // cutover migration (NOT concurrency-safe; don't run alongside live BA enrollment).
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
      const existing = await prisma.twoFactor.findUnique({
        where: { userId: user.id },
        select: { id: true },
      });
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
    const lastUser = users.at(-1);
    if (!lastUser) break; // unreachable (users is non-empty here) — keeps the keyset cursor type-safe
    lastUserId = lastUser.id;
  }

  return stats;
};
