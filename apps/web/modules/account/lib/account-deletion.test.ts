import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  consumeAccountDeletionSsoReauthentication: vi.fn(),
  deleteUser: vi.fn(),
  getIsMultiOrgEnabled: vi.fn(),
  getOrganizationsWhereUserIsSingleOwner: vi.fn(),
  getUser: vi.fn(),
  getUserAuthenticationData: vi.fn(),
  loggerWarn: vi.fn(),
  queueAccountDeletionEmailBackground: vi.fn(),
  verifyUserPassword: vi.fn(),
}));

const user = {
  email: "delete-user@example.com",
  id: "user-id",
};

const oldUser = {
  ...user,
  locale: "en-US",
  name: "Delete User",
};

const loadAccountDeletionModule = async ({
  dangerouslyDisableSsoConfirmation = false,
}: {
  dangerouslyDisableSsoConfirmation?: boolean;
} = {}) => {
  vi.resetModules();

  vi.doMock("@formbricks/logger", () => ({
    logger: {
      warn: mocks.loggerWarn,
    },
  }));

  vi.doMock("@/lib/constants", () => ({
    DISABLE_ACCOUNT_DELETION_SSO_CONFIRMATION: dangerouslyDisableSsoConfirmation,
  }));

  vi.doMock("@/lib/organization/service", () => ({
    getOrganizationsWhereUserIsSingleOwner: mocks.getOrganizationsWhereUserIsSingleOwner,
  }));

  vi.doMock("@/lib/user/password", () => ({
    getUserAuthenticationData: mocks.getUserAuthenticationData,
    verifyUserPassword: mocks.verifyUserPassword,
  }));

  vi.doMock("@/lib/user/service", () => ({
    deleteUser: mocks.deleteUser,
    getUser: mocks.getUser,
  }));

  vi.doMock("@/modules/account/lib/account-deletion-email", () => ({
    queueAccountDeletionEmailBackground: mocks.queueAccountDeletionEmailBackground,
  }));

  vi.doMock("@/modules/account/lib/account-deletion-sso-reauth", () => ({
    consumeAccountDeletionSsoReauthentication: mocks.consumeAccountDeletionSsoReauthentication,
  }));

  vi.doMock("@/modules/ee/license-check/lib/utils", () => ({
    getIsMultiOrgEnabled: mocks.getIsMultiOrgEnabled,
  }));

  return import("./account-deletion");
};

describe("deleteUserWithAccountDeletionAuthorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.consumeAccountDeletionSsoReauthentication.mockResolvedValue(undefined);
    mocks.deleteUser.mockResolvedValue(undefined);
    mocks.getIsMultiOrgEnabled.mockResolvedValue(true);
    mocks.getOrganizationsWhereUserIsSingleOwner.mockResolvedValue([]);
    mocks.getUser.mockResolvedValue(oldUser);
    mocks.getUserAuthenticationData.mockResolvedValue({
      email: user.email,
      identityProvider: "google",
      identityProviderAccountId: "google-account-id",
      password: null,
    });
    mocks.verifyUserPassword.mockResolvedValue(true);
  });

  test("requires the completed SSO identity confirmation marker by default", async () => {
    const { deleteUserWithAccountDeletionAuthorization } = await loadAccountDeletionModule();

    await expect(
      deleteUserWithAccountDeletionAuthorization({
        confirmationEmail: user.email,
        userEmail: user.email,
        userId: user.id,
      })
    ).resolves.toEqual({ oldUser });

    expect(mocks.consumeAccountDeletionSsoReauthentication).toHaveBeenCalledWith({
      identityProvider: "google",
      providerAccountId: "google-account-id",
      userId: user.id,
    });
    expect(mocks.getUser).toHaveBeenCalledBefore(mocks.consumeAccountDeletionSsoReauthentication);
    expect(mocks.consumeAccountDeletionSsoReauthentication).toHaveBeenCalledBefore(mocks.deleteUser);
    expect(mocks.deleteUser).toHaveBeenCalledWith(user.id);
  });

  test("can dangerously bypass SSO identity confirmation for passwordless SSO users", async () => {
    const { deleteUserWithAccountDeletionAuthorization } = await loadAccountDeletionModule({
      dangerouslyDisableSsoConfirmation: true,
    });

    await expect(
      deleteUserWithAccountDeletionAuthorization({
        confirmationEmail: user.email,
        userEmail: user.email,
        userId: user.id,
      })
    ).resolves.toEqual({ oldUser });

    expect(mocks.consumeAccountDeletionSsoReauthentication).not.toHaveBeenCalled();
    expect(mocks.loggerWarn).toHaveBeenCalledWith(
      { identityProvider: "google", userId: user.id },
      "Account deletion SSO identity confirmation bypassed by environment configuration"
    );
    expect(mocks.deleteUser).toHaveBeenCalledWith(user.id);
  });

  test("still requires password confirmation for password-backed users when the SSO bypass is enabled", async () => {
    mocks.getUserAuthenticationData.mockResolvedValueOnce({
      email: user.email,
      identityProvider: "email",
      identityProviderAccountId: null,
      password: "hashed-password",
    });
    const { deleteUserWithAccountDeletionAuthorization } = await loadAccountDeletionModule({
      dangerouslyDisableSsoConfirmation: true,
    });

    await expect(
      deleteUserWithAccountDeletionAuthorization({
        confirmationEmail: user.email,
        password: "correct-password",
        userEmail: user.email,
        userId: user.id,
      })
    ).resolves.toEqual({ oldUser });

    expect(mocks.verifyUserPassword).toHaveBeenCalledWith(user.id, "correct-password");
    expect(mocks.consumeAccountDeletionSsoReauthentication).not.toHaveBeenCalled();
    expect(mocks.deleteUser).toHaveBeenCalledWith(user.id);
  });

  test("does not consume the SSO marker when organization checks reject deletion", async () => {
    mocks.getIsMultiOrgEnabled.mockResolvedValueOnce(false);
    mocks.getOrganizationsWhereUserIsSingleOwner.mockResolvedValueOnce([{ id: "organization-id" }]);
    const { deleteUserWithAccountDeletionAuthorization } = await loadAccountDeletionModule();

    await expect(
      deleteUserWithAccountDeletionAuthorization({
        confirmationEmail: user.email,
        userEmail: user.email,
        userId: user.id,
      })
    ).rejects.toThrow("You are the only owner of this organization");

    expect(mocks.consumeAccountDeletionSsoReauthentication).not.toHaveBeenCalled();
    expect(mocks.deleteUser).not.toHaveBeenCalled();
  });

  test("queues the account deletion confirmation email after a successful deletion", async () => {
    const { deleteUserWithAccountDeletionAuthorization } = await loadAccountDeletionModule();

    await deleteUserWithAccountDeletionAuthorization({
      confirmationEmail: user.email,
      userEmail: user.email,
      userId: user.id,
    });

    expect(mocks.queueAccountDeletionEmailBackground).toHaveBeenCalledExactlyOnceWith({
      email: oldUser.email,
      locale: oldUser.locale,
      userId: user.id,
    });
    expect(mocks.deleteUser).toHaveBeenCalledBefore(mocks.queueAccountDeletionEmailBackground);
  });

  test("does not queue the confirmation email when deletion fails", async () => {
    mocks.deleteUser.mockRejectedValueOnce(new Error("Database error"));
    const { deleteUserWithAccountDeletionAuthorization } = await loadAccountDeletionModule();

    await expect(
      deleteUserWithAccountDeletionAuthorization({
        confirmationEmail: user.email,
        userEmail: user.email,
        userId: user.id,
      })
    ).rejects.toThrow("Database error");

    expect(mocks.queueAccountDeletionEmailBackground).not.toHaveBeenCalled();
  });
});
