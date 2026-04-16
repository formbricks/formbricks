/* eslint-disable import/no-extraneous-dependencies -- vitest is provided from the workspace root test toolchain. */
import { beforeEach, describe, expect, test, vi } from "vitest";
import { backfillLegacySsoAccounts, normalizeLegacySsoProvider } from "./migration";

describe("backfill legacy SSO accounts migration", () => {
  const queryRaw = vi.fn();
  const executeRaw = vi.fn();

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
    queryRaw
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          email: "legacy@example.com",
          id: "user_1",
          identityProvider: "google",
          identityProviderAccountId: "provider_1",
        },
      ])
      .mockResolvedValueOnce([]);

    const firstRun = await backfillLegacySsoAccounts({
      $executeRaw: executeRaw,
      $queryRaw: queryRaw,
    });

    expect(firstRun).toEqual({
      scanned: 1,
      inserted: 1,
      normalizedLegacyAccounts: 0,
      skippedConflict: 0,
      skippedExisting: 0,
      skippedMissingId: 0,
    });
    expect(executeRaw).toHaveBeenCalledTimes(1);

    vi.clearAllMocks();

    queryRaw
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          email: "legacy@example.com",
          id: "user_1",
          identityProvider: "google",
          identityProviderAccountId: "provider_1",
        },
      ])
      .mockResolvedValueOnce([
        {
          id: "account_1",
          provider: "google",
          providerAccountId: "provider_1",
          userId: "user_1",
        },
      ]);

    const secondRun = await backfillLegacySsoAccounts({
      $executeRaw: executeRaw,
      $queryRaw: queryRaw,
    });

    expect(secondRun).toEqual({
      scanned: 1,
      inserted: 0,
      normalizedLegacyAccounts: 0,
      skippedConflict: 0,
      skippedExisting: 1,
      skippedMissingId: 0,
    });
    expect(executeRaw).not.toHaveBeenCalled();
  });

  test("normalizes legacy Azure accounts and skips conflicting ownership", async () => {
    queryRaw
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
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: "canonical_conflict",
          provider: "azuread",
          providerAccountId: "azure_conflict",
          userId: "other_user",
        },
      ])
      .mockResolvedValueOnce([
        {
          email: "legacy@example.com",
          id: "user_1",
          identityProvider: "azuread",
          identityProviderAccountId: "azure_subject",
        },
        {
          email: "conflict@example.com",
          id: "user_2",
          identityProvider: "azuread",
          identityProviderAccountId: "azure_conflict",
        },
      ])
      .mockResolvedValueOnce([
        {
          id: "canonical_azure",
          provider: "azuread",
          providerAccountId: "azure_subject",
          userId: "user_1",
        },
      ])
      .mockResolvedValueOnce([
        {
          id: "canonical_conflict",
          provider: "azuread",
          providerAccountId: "azure_conflict",
          userId: "other_user",
        },
      ]);

    const stats = await backfillLegacySsoAccounts({
      $executeRaw: executeRaw,
      $queryRaw: queryRaw,
    });

    expect(stats).toEqual({
      scanned: 2,
      inserted: 0,
      normalizedLegacyAccounts: 1,
      skippedConflict: 2,
      skippedExisting: 1,
      skippedMissingId: 0,
    });
    expect(executeRaw).toHaveBeenCalledTimes(1);
  });
});
