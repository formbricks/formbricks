import { createId } from "@paralleldrive/cuid2";
import type { MigrationScript } from "../../src/scripts/migration-runner";

export interface TSsoBackfillStats {
  scanned: number;
  inserted: number;
  normalizedLegacyAccounts: number;
  skippedConflict: number;
  skippedExisting: number;
  skippedMissingId: number;
}

interface TMigrationTx {
  $executeRaw: (query: TemplateStringsArray, ...values: readonly unknown[]) => Promise<unknown>;
  $queryRaw: <T = unknown>(query: TemplateStringsArray, ...values: readonly unknown[]) => Promise<T>;
}

interface TLegacySsoUserRow {
  email: string;
  id: string;
  identityProvider: string;
  identityProviderAccountId: string | null;
}

interface TAccountRow {
  id: string;
  provider: string;
  providerAccountId: string;
  userId: string;
}

const LEGACY_SSO_PROVIDER_MAP: Record<string, string> = {
  google: "google",
  github: "github",
  "azure-ad": "azuread",
  azuread: "azuread",
  openid: "openid",
  saml: "saml",
};

export const normalizeLegacySsoProvider = (provider: string): string | null =>
  LEGACY_SSO_PROVIDER_MAP[provider] ?? null;

export const backfillLegacySsoAccounts = async (tx: TMigrationTx): Promise<TSsoBackfillStats> => {
  const stats: TSsoBackfillStats = {
    scanned: 0,
    inserted: 0,
    normalizedLegacyAccounts: 0,
    skippedConflict: 0,
    skippedExisting: 0,
    skippedMissingId: 0,
  };

  const legacyAzureAccounts = await tx.$queryRaw<TAccountRow[]>`
    SELECT "id", "userId", "provider", "providerAccountId"
    FROM "Account"
    WHERE "provider" = 'azure-ad'
  `;

  for (const legacyAccount of legacyAzureAccounts) {
    const canonicalAccounts = await tx.$queryRaw<TAccountRow[]>`
      SELECT "id", "userId", "provider", "providerAccountId"
      FROM "Account"
      WHERE "provider" = 'azuread'
        AND "providerAccountId" = ${legacyAccount.providerAccountId}
      LIMIT 1
    `;
    const hasCanonicalAccount = canonicalAccounts.length > 0;

    if (hasCanonicalAccount) {
      const canonicalAccount = canonicalAccounts[0];

      if (canonicalAccount.userId !== legacyAccount.userId) {
        stats.skippedConflict += 1;
        console.warn(
          `Skipping Azure account normalization for providerAccountId ${legacyAccount.providerAccountId}; canonical account belongs to a different user.`
        );
        continue;
      }

      await tx.$executeRaw`
        DELETE FROM "Account"
        WHERE "id" = ${legacyAccount.id}
      `;
      stats.normalizedLegacyAccounts += 1;
      continue;
    }

    await tx.$executeRaw`
      UPDATE "Account"
      SET "provider" = 'azuread',
          "updated_at" = NOW()
      WHERE "id" = ${legacyAccount.id}
    `;
    stats.normalizedLegacyAccounts += 1;
  }

  const legacySsoUsers = await tx.$queryRaw<TLegacySsoUserRow[]>`
    SELECT "id", "email", "identityProvider", "identityProviderAccountId"
    FROM "User"
    WHERE "identityProvider" <> 'email'
  `;

  stats.scanned = legacySsoUsers.length;

  for (const user of legacySsoUsers) {
    const provider = normalizeLegacySsoProvider(user.identityProvider);

    if (!provider || !user.identityProviderAccountId) {
      stats.skippedMissingId += 1;
      continue;
    }

    const existingAccounts = await tx.$queryRaw<TAccountRow[]>`
      SELECT "id", "userId", "provider", "providerAccountId"
      FROM "Account"
      WHERE "provider" = ${provider}
        AND "providerAccountId" = ${user.identityProviderAccountId}
      LIMIT 1
    `;
    const hasExistingAccount = existingAccounts.length > 0;

    if (!hasExistingAccount) {
      await tx.$executeRaw`
        INSERT INTO "Account" ("id", "created_at", "updated_at", "userId", "type", "provider", "providerAccountId")
        VALUES (${createId()}, NOW(), NOW(), ${user.id}, 'oauth', ${provider}, ${user.identityProviderAccountId})
      `;
      stats.inserted += 1;
      continue;
    }

    const existingAccount = existingAccounts[0];

    if (existingAccount.userId === user.id) {
      stats.skippedExisting += 1;
      continue;
    }

    stats.skippedConflict += 1;
    console.warn(
      `Skipping legacy SSO backfill for user ${user.id} (${user.email}); provider ${provider} / account ${user.identityProviderAccountId} is already linked to another user.`
    );
  }

  console.log(
    [
      "Legacy SSO account backfill completed.",
      `scanned=${String(stats.scanned)}`,
      `normalizedLegacyAccounts=${String(stats.normalizedLegacyAccounts)}`,
      `inserted=${String(stats.inserted)}`,
      `skippedExisting=${String(stats.skippedExisting)}`,
      `skippedConflict=${String(stats.skippedConflict)}`,
      `skippedMissingId=${String(stats.skippedMissingId)}`,
    ].join(" ")
  );

  return stats;
};

export const backfillLegacySsoAccountsMigration: MigrationScript = {
  type: "data",
  id: "yukzmjww0s5y9akghq8v2f8c",
  name: "20260416110000_backfill_legacy_sso_accounts",
  run: async ({ tx }) => {
    await backfillLegacySsoAccounts(tx);
  },
};
