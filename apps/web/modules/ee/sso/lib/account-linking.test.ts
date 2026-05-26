import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { syncSsoIdentityForUser } from "./account-linking";
import { OAUTH_ACCOUNT_NOT_LINKED_ERROR } from "./constants";

const mocks = vi.hoisted(() => ({
  accountFindUnique: vi.fn(),
  accountDelete: vi.fn(),
  accountUpdate: vi.fn(),
  accountCreate: vi.fn(),
  userUpdate: vi.fn(),
}));

vi.mock("@formbricks/database", () => ({
  prisma: {
    $transaction: vi.fn(),
    account: {
      findUnique: mocks.accountFindUnique,
      delete: mocks.accountDelete,
      update: mocks.accountUpdate,
      create: mocks.accountCreate,
    },
    user: {
      update: mocks.userUpdate,
    },
  },
}));

describe("syncSsoIdentityForUser", () => {
  const account = {
    type: "oauth" as const,
    provider: "google",
    providerAccountId: "provider-account-1",
    access_token: "access-token",
    refresh_token: "refresh-token",
    scope: "openid email profile",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.$transaction).mockImplementation(async (callback) =>
      callback({
        account: {
          findUnique: mocks.accountFindUnique,
          delete: mocks.accountDelete,
          update: mocks.accountUpdate,
          create: mocks.accountCreate,
        },
        user: {
          update: mocks.userUpdate,
        },
      } as any)
    );
    mocks.accountFindUnique.mockResolvedValue(null);
    mocks.accountDelete.mockResolvedValue(undefined);
    mocks.accountUpdate.mockResolvedValue(undefined);
    mocks.accountCreate.mockResolvedValue(undefined);
    mocks.userUpdate.mockResolvedValue(undefined);
  });

  test("throws when the canonical account is already linked to a different user", async () => {
    mocks.accountFindUnique.mockResolvedValue({
      id: "account_1",
      userId: "user_2",
    });

    await expect(
      syncSsoIdentityForUser({
        userId: "user_1",
        provider: "google",
        account,
      })
    ).rejects.toThrow(OAUTH_ACCOUNT_NOT_LINKED_ERROR);

    expect(mocks.accountUpdate).not.toHaveBeenCalled();
    expect(mocks.accountCreate).not.toHaveBeenCalled();
    expect(mocks.userUpdate).not.toHaveBeenCalled();
  });

  test("removes a legacy account row and refreshes the canonical account tokens when both exist", async () => {
    mocks.accountFindUnique.mockResolvedValue({
      id: "account_1",
      userId: "user_1",
    });

    await syncSsoIdentityForUser({
      userId: "user_1",
      provider: "google",
      account,
      legacyAccountIdToNormalize: "legacy_account_1",
    });

    expect(mocks.accountDelete).toHaveBeenCalledWith({
      where: {
        id: "legacy_account_1",
      },
    });
    expect(mocks.accountUpdate).toHaveBeenCalledWith({
      where: {
        id: "account_1",
      },
      data: {
        access_token: "access-token",
        refresh_token: "refresh-token",
        scope: "openid email profile",
      },
    });
    expect(mocks.userUpdate).toHaveBeenCalledWith({
      where: {
        id: "user_1",
      },
      data: {
        identityProvider: "google",
        identityProviderAccountId: "provider-account-1",
      },
    });
  });

  test("reassigns a legacy account row when no canonical account exists yet", async () => {
    await syncSsoIdentityForUser({
      userId: "user_1",
      provider: "google",
      account,
      legacyAccountIdToNormalize: "legacy_account_1",
    });

    expect(mocks.accountUpdate).toHaveBeenCalledWith({
      where: {
        id: "legacy_account_1",
      },
      data: {
        userId: "user_1",
        type: "oauth",
        provider: "google",
        providerAccountId: "provider-account-1",
        access_token: "access-token",
        refresh_token: "refresh-token",
        scope: "openid email profile",
      },
    });
    expect(mocks.accountCreate).not.toHaveBeenCalled();
  });

  test("wraps non-transactional calls in a prisma transaction", async () => {
    await syncSsoIdentityForUser({
      userId: "user_1",
      provider: "google",
      account,
    });

    expect(prisma.$transaction).toHaveBeenCalledOnce();
  });

  test("uses the transaction client when one is provided", async () => {
    const txAccountFindUnique = vi.fn().mockResolvedValue({
      id: "account_1",
      userId: "user_1",
    });
    const txAccountUpdate = vi.fn().mockResolvedValue(undefined);
    const txUserUpdate = vi.fn().mockResolvedValue(undefined);
    const tx = {
      account: {
        findUnique: txAccountFindUnique,
        update: txAccountUpdate,
      },
      user: {
        update: txUserUpdate,
      },
    };

    await syncSsoIdentityForUser({
      userId: "user_1",
      provider: "google",
      account,
      tx: tx as any,
    });

    expect(txAccountFindUnique).toHaveBeenCalledOnce();
    expect(txAccountUpdate).toHaveBeenCalledWith({
      where: {
        id: "account_1",
      },
      data: {
        access_token: "access-token",
        refresh_token: "refresh-token",
        scope: "openid email profile",
      },
    });
    expect(txUserUpdate).toHaveBeenCalledWith({
      where: {
        id: "user_1",
      },
      data: {
        identityProvider: "google",
        identityProviderAccountId: "provider-account-1",
      },
    });
    expect(prisma.account.findUnique).not.toHaveBeenCalled();
  });

  test("creates a canonical account when no account rows exist yet", async () => {
    await syncSsoIdentityForUser({
      userId: "user_1",
      provider: "google",
      account: {
        ...account,
        expires_at: 1234,
        token_type: "Bearer",
        id_token: "id-token",
      },
    });

    expect(mocks.accountCreate).toHaveBeenCalledWith({
      data: {
        userId: "user_1",
        type: "oauth",
        provider: "google",
        providerAccountId: "provider-account-1",
        access_token: "access-token",
        refresh_token: "refresh-token",
        expires_at: 1234,
        scope: "openid email profile",
        token_type: "Bearer",
        id_token: "id-token",
      },
    });
    expect(mocks.userUpdate).toHaveBeenCalledOnce();
  });
});
