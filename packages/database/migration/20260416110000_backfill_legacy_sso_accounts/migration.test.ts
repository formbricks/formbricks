/* eslint-disable import/no-extraneous-dependencies -- vitest is provided from the workspace root test toolchain. */
import { beforeEach, describe, expect, test, vi } from "vitest";
import { backfillLegacySsoAccounts, normalizeLegacySsoProvider } from "./migration";

describe("backfill legacy SSO accounts migration", () => {
  interface TMigrationTxMock {
    tx: Parameters<typeof backfillLegacySsoAccounts>[0];
    queryRaw: ReturnType<typeof vi.fn>;
    executeRaw: ReturnType<typeof vi.fn>;
  }

  const createMigrationTxMock = (): TMigrationTxMock => {
    const queryRaw = vi.fn();
    const executeRaw = vi.fn();

    return {
      tx: {
        $executeRaw: executeRaw,
        $queryRaw: queryRaw,
      },
      queryRaw,
      executeRaw,
    };
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("normalizes all supported legacy provider ids", () => {
    expect(normalizeLegacySsoProvider("google")).toBe("google");
    expect(normalizeLegacySsoProvider("github")).toBe("github");
    expect(normalizeLegacySsoProvider("azure-ad")).toBe("azuread");
    expect(normalizeLegacySsoProvider("azuread")).toBe("azuread");
    expect(normalizeLegacySsoProvider("openid")).toBe("openid");
    expect(normalizeLegacySsoProvider("saml")).toBe("saml");
    expect(normalizeLegacySsoProvider("email")).toBeNull();
  });

  test("backfills missing account rows and reports idempotent reruns as existing", async () => {
    const firstRunMock = createMigrationTxMock();

    firstRunMock.queryRaw
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: "user_1",
          identityProvider: "google",
          identityProviderAccountId: "provider_1",
        },
      ]);

    const firstRun = await backfillLegacySsoAccounts(firstRunMock.tx);

    expect(firstRun).toEqual({
      scanned: 1,
      inserted: 1,
      normalizedLegacyAccounts: 0,
      skippedConflict: 0,
      skippedExisting: 0,
      skippedMissingId: 0,
    });
    expect(firstRunMock.executeRaw).toHaveBeenCalledTimes(1);

    const secondRunMock = createMigrationTxMock();
    secondRunMock.queryRaw
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: "account_1",
          provider: "google",
          providerAccountId: "provider_1",
          userId: "user_1",
        },
      ])
      .mockResolvedValueOnce([
        {
          id: "user_1",
          identityProvider: "google",
          identityProviderAccountId: "provider_1",
        },
      ]);

    const secondRun = await backfillLegacySsoAccounts(secondRunMock.tx);

    expect(secondRun).toEqual({
      scanned: 1,
      inserted: 0,
      normalizedLegacyAccounts: 0,
      skippedConflict: 0,
      skippedExisting: 1,
      skippedMissingId: 0,
    });
    expect(secondRunMock.executeRaw).not.toHaveBeenCalled();
  });

  test("normalizes legacy Azure accounts and skips conflicting ownership", async () => {
    const migrationMock = createMigrationTxMock();
    migrationMock.queryRaw
      .mockResolvedValueOnce([
        {
          id: "legacy_account",
          provider: "azure-ad",
          providerAccountId: "azure_subject",
          userId: "user_1",
        },
        {
          id: "conflicting_legacy_account",
          provider: "azure-ad",
          providerAccountId: "azure_conflict",
          userId: "user_2",
        },
      ])
      .mockResolvedValueOnce([
        {
          id: "canonical_conflict",
          provider: "azuread",
          providerAccountId: "azure_conflict",
          userId: "other_user",
        },
        {
          id: "canonical_azure",
          provider: "azuread",
          providerAccountId: "azure_subject",
          userId: "user_1",
        },
      ])
      .mockResolvedValueOnce([
        {
          id: "user_1",
          identityProvider: "azuread",
          identityProviderAccountId: "azure_subject",
        },
        {
          id: "user_2",
          identityProvider: "azuread",
          identityProviderAccountId: "azure_conflict",
        },
      ]);

    const stats = await backfillLegacySsoAccounts(migrationMock.tx);

    expect(stats).toEqual({
      scanned: 2,
      inserted: 0,
      normalizedLegacyAccounts: 1,
      skippedConflict: 2,
      skippedExisting: 1,
      skippedMissingId: 0,
    });
    expect(migrationMock.executeRaw).toHaveBeenCalledTimes(1);
  });

  test("skips stale legacy provider ids when the user already has a canonical account for that provider", async () => {
    const migrationMock = createMigrationTxMock();
    migrationMock.queryRaw
      .mockResolvedValueOnce([
        {
          id: "legacy_azure_account",
          provider: "azure-ad",
          providerAccountId: "stale-subject",
          userId: "user_1",
        },
      ])
      .mockResolvedValueOnce([
        {
          id: "canonical_azure_account",
          provider: "azuread",
          providerAccountId: "current-subject",
          userId: "user_1",
        },
      ])
      .mockResolvedValueOnce([
        {
          id: "user_1",
          identityProvider: "azuread",
          identityProviderAccountId: "stale-subject",
        },
      ]);

    const stats = await backfillLegacySsoAccounts(migrationMock.tx);

    expect(stats).toEqual({
      scanned: 1,
      inserted: 0,
      normalizedLegacyAccounts: 0,
      skippedConflict: 0,
      skippedExisting: 2,
      skippedMissingId: 0,
    });
    expect(migrationMock.executeRaw).not.toHaveBeenCalled();
  });
});
