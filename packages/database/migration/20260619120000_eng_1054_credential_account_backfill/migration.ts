import { createId } from "@paralleldrive/cuid2";
import type { MigrationScript } from "../../src/scripts/migration-runner";

export interface TCredentialBackfillStats {
  scanned: number;
  inserted: number;
  skippedExisting: number;
}

interface TMigrationTx {
  $executeRaw: (query: TemplateStringsArray, ...values: readonly unknown[]) => Promise<number>;
  $queryRaw: <T = unknown>(query: TemplateStringsArray, ...values: readonly unknown[]) => Promise<T>;
}

interface TCredentialUserRow {
  id: string;
  password: string;
}

const CREDENTIAL_USER_BATCH_SIZE = 1000;

/**
 * ENG-1054: backfill `credential` Account rows from `User.password` so Better Auth's email/password
 * sign-in works for existing (NextAuth-era) users at cutover.
 *
 * NextAuth kept the bcrypt hash on `User.password`; Better Auth instead reads it from a "credential"
 * Account row (providerAccountId = the user id) holding that password. The hash is copied VERBATIM —
 * auth.ts's `password.verify` is the same bcrypt (`verifySecret`), so existing users keep their
 * password (no re-hash, no forced reset). Idempotent via `ON CONFLICT (provider, providerAccountId)`
 * and batched by user id. Mirrors backfill_legacy_sso_accounts (the SSO half of the cutover backfill).
 */
export const backfillCredentialAccounts = async (tx: TMigrationTx): Promise<TCredentialBackfillStats> => {
  const stats: TCredentialBackfillStats = { scanned: 0, inserted: 0, skippedExisting: 0 };

  const fetchBatch = async (afterUserId: string | null): Promise<TCredentialUserRow[]> => {
    if (afterUserId) {
      return tx.$queryRaw<TCredentialUserRow[]>`
        SELECT "id", "password" FROM "User"
        WHERE "password" IS NOT NULL AND "id" > ${afterUserId}
        ORDER BY "id" ASC
        LIMIT ${CREDENTIAL_USER_BATCH_SIZE}
      `;
    }
    return tx.$queryRaw<TCredentialUserRow[]>`
      SELECT "id", "password" FROM "User"
      WHERE "password" IS NOT NULL
      ORDER BY "id" ASC
      LIMIT ${CREDENTIAL_USER_BATCH_SIZE}
    `;
  };

  let lastProcessedUserId: string | null = null;
  let hasMoreUsers = true;

  while (hasMoreUsers) {
    const users = await fetchBatch(lastProcessedUserId);
    if (users.length === 0) {
      hasMoreUsers = false;
      continue;
    }
    stats.scanned += users.length;

    for (const user of users) {
      // Better Auth's credential account: provider "credential", providerAccountId = the user id.
      const affected = await tx.$executeRaw`
        INSERT INTO "Account" ("id", "created_at", "updated_at", "userId", "type", "provider", "providerAccountId", "password")
        VALUES (${createId()}, NOW(), NOW(), ${user.id}, 'credential', 'credential', ${user.id}, ${user.password})
        ON CONFLICT ("provider", "providerAccountId") DO NOTHING
      `;
      if (affected > 0) {
        stats.inserted += 1;
      } else {
        stats.skippedExisting += 1;
      }
    }

    lastProcessedUserId = users[users.length - 1].id;
  }

  console.log(
    [
      "Credential account backfill completed.",
      `scanned=${String(stats.scanned)}`,
      `inserted=${String(stats.inserted)}`,
      `skippedExisting=${String(stats.skippedExisting)}`,
    ].join(" ")
  );

  return stats;
};

export const eng1054CredentialAccountBackfillMigration: MigrationScript = {
  type: "data",
  id: "iwf3j0x9z4hvjs6jk43m3acm",
  name: "20260619120000_eng_1054_credential_account_backfill",
  run: async ({ tx }) => {
    await backfillCredentialAccounts(tx);
  },
};
