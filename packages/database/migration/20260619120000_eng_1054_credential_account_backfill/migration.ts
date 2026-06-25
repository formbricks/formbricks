import { createId } from "@paralleldrive/cuid2";
import { logger } from "@formbricks/logger";
import { Prisma } from "../../src/prisma";
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

    // Better Auth's credential account: provider "credential", providerAccountId = the user id.
    // One multi-row INSERT per batch (not one statement per user) → far fewer round-trips and a
    // shorter lock window. ON CONFLICT keeps it idempotent; the affected-row count is the number
    // actually inserted, so the rest of the batch already existed.
    const rows = users.map(
      (user) =>
        Prisma.sql`(${createId()}, NOW(), NOW(), ${user.id}, 'credential', 'credential', ${user.id}, ${user.password})`
    );
    const inserted = await tx.$executeRaw`
      INSERT INTO "Account" ("id", "created_at", "updated_at", "userId", "type", "provider", "providerAccountId", "password")
      VALUES ${Prisma.join(rows)}
      ON CONFLICT ("provider", "providerAccountId") DO NOTHING
    `;
    stats.inserted += inserted;
    stats.skippedExisting += users.length - inserted;

    lastProcessedUserId = users[users.length - 1].id;
  }

  logger.info(
    `Credential account backfill completed. scanned=${stats.scanned} inserted=${stats.inserted} skippedExisting=${stats.skippedExisting}`
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
