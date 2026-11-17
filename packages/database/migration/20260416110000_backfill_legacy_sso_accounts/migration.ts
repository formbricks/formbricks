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

const LEGACY_SSO_USER_BATCH_SIZE = 1000;

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

const getAccountKey = (provider: string, providerAccountId: string): string =>
  `${provider}:${providerAccountId}`;

const getUserProviderKey = (userId: string, provider: string): string => `${userId}:${provider}`;

/** The canonical accounts, by provider account and by user and provider, kept current as rows change. */
interface TAccountIndex {
  byKey: Map<string, TAccountRow>;
  byUserProvider: Map<string, TAccountRow>;
}

const indexAccount = (
  index: TAccountIndex,
  accountKey: string,
  userProviderKey: string,
  account: TAccountRow
) => {
  index.byKey.set(accountKey, account);
  index.byUserProvider.set(userProviderKey, account);
};

/** Renames one legacy `azure-ad` account to `azuread`, or drops it when the canonical one exists. */
const normalizeLegacyAzureAccount = async (
  tx: TMigrationTx,
  legacyAccount: TAccountRow,
  index: TAccountIndex,
  stats: TSsoBackfillStats
): Promise<void> => {
  const accountKey = getAccountKey("azuread", legacyAccount.providerAccountId);
  const canonicalAccount = index.byKey.get(accountKey);
  const userProviderKey = getUserProviderKey(legacyAccount.userId, "azuread");
  const existingUserProviderAccount = index.byUserProvider.get(userProviderKey);

  if (canonicalAccount) {
    if (canonicalAccount.userId !== legacyAccount.userId) {
      stats.skippedConflict += 1;
      console.warn(
        [
          "Skipping Azure account normalization due to ownership conflict.",
          `provider=azuread`,
          `legacyAccountId=${legacyAccount.id}`,
          `legacyUserId=${legacyAccount.userId}`,
          `canonicalAccountId=${canonicalAccount.id}`,
          `canonicalUserId=${canonicalAccount.userId}`,
        ].join(" ")
      );
      return;
    }

    await tx.$executeRaw`
      DELETE FROM "Account"
      WHERE "id" = ${legacyAccount.id}
    `;
    stats.normalizedLegacyAccounts += 1;
    return;
  }

  if (existingUserProviderAccount) {
    stats.skippedExisting += 1;
    console.warn(
      [
        "Skipping Azure account normalization because a canonical account already exists.",
        `provider=azuread`,
        `legacyAccountId=${legacyAccount.id}`,
        `legacyUserId=${legacyAccount.userId}`,
        `canonicalAccountId=${existingUserProviderAccount.id}`,
        `canonicalUserId=${existingUserProviderAccount.userId}`,
      ].join(" ")
    );
    return;
  }

  await tx.$executeRaw`
    UPDATE "Account"
    SET "provider" = 'azuread',
        "updated_at" = NOW()
    WHERE "id" = ${legacyAccount.id}
  `;
  stats.normalizedLegacyAccounts += 1;
  indexAccount(index, accountKey, userProviderKey, {
    ...legacyAccount,
    provider: "azuread",
  });
};

const fetchLegacySsoUserBatch = async (
  tx: TMigrationTx,
  afterUserId: string | null
): Promise<TLegacySsoUserRow[]> => {
  if (afterUserId) {
    return tx.$queryRaw<TLegacySsoUserRow[]>`
      SELECT "id", "identityProvider", "identityProviderAccountId"
      FROM "User"
      WHERE "identityProvider" <> 'email'
        AND "id" > ${afterUserId}
      ORDER BY "id" ASC
      LIMIT ${LEGACY_SSO_USER_BATCH_SIZE}
    `;
  }

  return tx.$queryRaw<TLegacySsoUserRow[]>`
    SELECT "id", "identityProvider", "identityProviderAccountId"
    FROM "User"
    WHERE "identityProvider" <> 'email'
    ORDER BY "id" ASC
    LIMIT ${LEGACY_SSO_USER_BATCH_SIZE}
  `;
};

/** Creates the account a legacy SSO user's identity columns describe, unless one exists. */
const backfillUserAccount = async (
  tx: TMigrationTx,
  user: TLegacySsoUserRow,
  index: TAccountIndex,
  stats: TSsoBackfillStats
): Promise<void> => {
  const provider = normalizeLegacySsoProvider(user.identityProvider);

  if (!provider || !user.identityProviderAccountId) {
    stats.skippedMissingId += 1;
    return;
  }

  const accountKey = getAccountKey(provider, user.identityProviderAccountId);
  const existingAccount = index.byKey.get(accountKey);
  const userProviderKey = getUserProviderKey(user.id, provider);
  const existingUserProviderAccount = index.byUserProvider.get(userProviderKey);

  if (existingAccount) {
    if (existingAccount.userId === user.id) {
      stats.skippedExisting += 1;
      return;
    }

    stats.skippedConflict += 1;
    console.warn(`Skipping legacy SSO backfill due to ownership conflict for provider ${provider}.`);
    return;
  }

  if (existingUserProviderAccount) {
    stats.skippedExisting += 1;
    console.warn("Skipping legacy SSO backfill because a canonical account already exists.");
    return;
  }

  const insertedAccountId = createId();
  await tx.$executeRaw`
    INSERT INTO "Account" ("id", "created_at", "updated_at", "userId", "type", "provider", "providerAccountId")
    VALUES (${insertedAccountId}, NOW(), NOW(), ${user.id}, 'oauth', ${provider}, ${user.identityProviderAccountId})
  `;
  stats.inserted += 1;
  indexAccount(index, accountKey, userProviderKey, {
    id: insertedAccountId,
    userId: user.id,
    provider,
    providerAccountId: user.identityProviderAccountId,
  });
};

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
  const canonicalAccounts = await tx.$queryRaw<TAccountRow[]>`
    SELECT "id", "userId", "provider", "providerAccountId"
    FROM "Account"
    WHERE "provider" IN ('google', 'github', 'azuread', 'openid', 'saml')
  `;
  const index: TAccountIndex = {
    byKey: new Map(
      canonicalAccounts.map((account) => [
        getAccountKey(account.provider, account.providerAccountId),
        account,
      ])
    ),
    byUserProvider: new Map(
      canonicalAccounts.map((account) => [getUserProviderKey(account.userId, account.provider), account])
    ),
  };

  for (const legacyAccount of legacyAzureAccounts) {
    await normalizeLegacyAzureAccount(tx, legacyAccount, index, stats);
  }

  let lastProcessedUserId: string | null = null;
  let hasMoreUsers = true;

  while (hasMoreUsers) {
    const legacySsoUsers = await fetchLegacySsoUserBatch(tx, lastProcessedUserId);

    if (legacySsoUsers.length === 0) {
      hasMoreUsers = false;
      continue;
    }

    stats.scanned += legacySsoUsers.length;

    for (const user of legacySsoUsers) {
      await backfillUserAccount(tx, user, index, stats);
    }

    lastProcessedUserId = legacySsoUsers[legacySsoUsers.length - 1].id;
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
