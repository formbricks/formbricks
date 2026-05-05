import { beforeEach, describe, expect, test, vi } from "vitest";
import {
  AuthorizationError,
  InvalidInputError,
  OperationNotAllowedError,
  TooManyRequestsError,
} from "@formbricks/types/errors";
import { deleteUserAction, startAccountDeletionSsoReauthenticationAction } from "./actions";
import { DELETE_ACCOUNT_SSO_REAUTH_REQUIRED_ERROR, DELETE_ACCOUNT_WRONG_PASSWORD_ERROR } from "./constants";

const mocks = vi.hoisted(() => ({
  applyRateLimit: vi.fn(),
  consumeAccountDeletionSsoReauthentication: vi.fn(),
  deleteUser: vi.fn(),
  getIsMultiOrgEnabled: vi.fn(),
  getOrganizationsWhereUserIsSingleOwner: vi.fn(),
  getUser: vi.fn(),
  getUserAuthenticationData: vi.fn(),
  loggerError: vi.fn(),
  loggerWarn: vi.fn(),
  startAccountDeletionSsoReauthentication: vi.fn(),
  verifyUserPassword: vi.fn(),
}));

vi.mock("@formbricks/logger", () => ({
  logger: {
    error: mocks.loggerError,
    warn: mocks.loggerWarn,
  },
}));

vi.mock("@/lib/constants", () => ({
  DISABLE_ACCOUNT_DELETION_SSO_REAUTH: false,
}));

vi.mock("@/lib/organization/service", () => ({
  getOrganizationsWhereUserIsSingleOwner: mocks.getOrganizationsWhereUserIsSingleOwner,
}));

vi.mock("@/lib/user/password", () => ({
  getUserAuthenticationData: mocks.getUserAuthenticationData,
  verifyUserPassword: mocks.verifyUserPassword,
}));

vi.mock("@/lib/user/service", () => ({
  deleteUser: mocks.deleteUser,
  getUser: mocks.getUser,
}));

vi.mock("@/lib/utils/action-client", () => ({
  authenticatedActionClient: {
    inputSchema: vi.fn(() => ({
      action: vi.fn((handler) => handler),
    })),
  },
}));

vi.mock("@/modules/account/lib/account-deletion-sso-reauth", () => ({
  consumeAccountDeletionSsoReauthentication: mocks.consumeAccountDeletionSsoReauthentication,
  startAccountDeletionSsoReauthentication: mocks.startAccountDeletionSsoReauthentication,
}));

vi.mock("@/modules/core/rate-limit/helpers", () => ({
  applyRateLimit: mocks.applyRateLimit,
}));

vi.mock("@/modules/core/rate-limit/rate-limit-configs", () => ({
  rateLimitConfigs: {
    actions: {
      accountDeletion: { interval: 3600, allowedPerInterval: 5, namespace: "action:account-delete" },
    },
  },
}));

vi.mock("@/modules/ee/audit-logs/lib/handler", () => ({
  withAuditLogging: vi.fn((_action, _target, handler) => handler),
}));

vi.mock("@/modules/ee/license-check/lib/utils", () => ({
  getIsMultiOrgEnabled: mocks.getIsMultiOrgEnabled,
}));

const user = {
  email: "delete-user@example.com",
  id: "user-id",
};

const createActionContext = () => ({
  auditLoggingCtx: {},
  user,
});

describe("delete account actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.applyRateLimit.mockResolvedValue({ allowed: true });
    mocks.consumeAccountDeletionSsoReauthentication.mockResolvedValue(undefined);
    mocks.deleteUser.mockResolvedValue(user);
    mocks.getIsMultiOrgEnabled.mockResolvedValue(true);
    mocks.getOrganizationsWhereUserIsSingleOwner.mockResolvedValue([]);
    mocks.getUser.mockResolvedValue(user);
    mocks.getUserAuthenticationData.mockResolvedValue({
      email: user.email,
      identityProvider: "email",
      identityProviderAccountId: null,
      password: "hashed-password",
    });
    mocks.startAccountDeletionSsoReauthentication.mockResolvedValue({
      authorizationParams: { login_hint: user.email, max_age: "0", prompt: "login" },
      callbackUrl: "http://localhost:3000/auth/account-deletion/sso/complete?intent=intent-token",
      provider: "google",
    });
    mocks.verifyUserPassword.mockResolvedValue(true);
  });

  test("rate-limits malformed delete attempts before parsing the payload", async () => {
    const rateLimitError = new TooManyRequestsError("Maximum number of requests reached");
    mocks.applyRateLimit.mockRejectedValueOnce(rateLimitError);

    await expect(
      deleteUserAction({
        ctx: createActionContext(),
        parsedInput: null,
      } as any)
    ).rejects.toThrow(TooManyRequestsError);

    expect(mocks.applyRateLimit).toHaveBeenCalled();
    expect(mocks.getUserAuthenticationData).not.toHaveBeenCalled();
    expect(mocks.deleteUser).not.toHaveBeenCalled();
  });

  test("rejects malformed delete payloads after rate limiting", async () => {
    await expect(
      deleteUserAction({
        ctx: createActionContext(),
        parsedInput: { confirmationEmail: user.email, extra: "unexpected" },
      } as any)
    ).rejects.toThrow(InvalidInputError);

    expect(mocks.applyRateLimit).toHaveBeenCalled();
    expect(mocks.getUserAuthenticationData).not.toHaveBeenCalled();
    expect(mocks.deleteUser).not.toHaveBeenCalled();
  });

  test("requires a password for password-backed users", async () => {
    await expect(
      deleteUserAction({
        ctx: createActionContext(),
        parsedInput: { confirmationEmail: user.email },
      } as any)
    ).rejects.toThrow(InvalidInputError);

    expect(mocks.verifyUserPassword).not.toHaveBeenCalled();
    expect(mocks.consumeAccountDeletionSsoReauthentication).not.toHaveBeenCalled();
    expect(mocks.deleteUser).not.toHaveBeenCalled();
  });

  test("rejects deletion when the confirmation email does not match the authenticated user", async () => {
    await expect(
      deleteUserAction({
        ctx: createActionContext(),
        parsedInput: { confirmationEmail: "attacker@example.com", password: "correct-password" },
      } as any)
    ).rejects.toThrow(AuthorizationError);

    expect(mocks.getUserAuthenticationData).not.toHaveBeenCalled();
    expect(mocks.verifyUserPassword).not.toHaveBeenCalled();
    expect(mocks.consumeAccountDeletionSsoReauthentication).not.toHaveBeenCalled();
    expect(mocks.deleteUser).not.toHaveBeenCalled();
  });

  test("returns the wrong password error for password-backed users with an invalid password", async () => {
    mocks.verifyUserPassword.mockResolvedValueOnce(false);

    await expect(
      deleteUserAction({
        ctx: createActionContext(),
        parsedInput: { confirmationEmail: user.email, password: "wrong-password" },
      } as any)
    ).rejects.toThrow(DELETE_ACCOUNT_WRONG_PASSWORD_ERROR);

    expect(mocks.verifyUserPassword).toHaveBeenCalledWith(user.id, "wrong-password");
    expect(mocks.deleteUser).not.toHaveBeenCalled();
  });

  test("deletes password-backed users with matching email and password", async () => {
    const result = await deleteUserAction({
      ctx: createActionContext(),
      parsedInput: { confirmationEmail: user.email.toUpperCase(), password: "correct-password" },
    } as any);

    expect(mocks.verifyUserPassword).toHaveBeenCalledWith(user.id, "correct-password");
    expect(mocks.deleteUser).toHaveBeenCalledWith(user.id);
    expect(result).toEqual({ success: true });
  });

  test("rejects direct email-only deletion for SSO users without a completed reauth marker", async () => {
    mocks.getUserAuthenticationData.mockResolvedValueOnce({
      email: user.email,
      identityProvider: "google",
      identityProviderAccountId: "google-account-id",
      password: null,
    });
    mocks.consumeAccountDeletionSsoReauthentication.mockRejectedValueOnce(
      new AuthorizationError(DELETE_ACCOUNT_SSO_REAUTH_REQUIRED_ERROR)
    );

    await expect(
      deleteUserAction({
        ctx: createActionContext(),
        parsedInput: { confirmationEmail: user.email },
      } as any)
    ).rejects.toThrow(DELETE_ACCOUNT_SSO_REAUTH_REQUIRED_ERROR);

    expect(mocks.consumeAccountDeletionSsoReauthentication).toHaveBeenCalledWith({
      identityProvider: "google",
      providerAccountId: "google-account-id",
      userId: user.id,
    });
    expect(mocks.deleteUser).not.toHaveBeenCalled();
  });

  test("deletes SSO users after consuming a completed reauth marker", async () => {
    mocks.getUserAuthenticationData.mockResolvedValueOnce({
      email: user.email,
      identityProvider: "google",
      identityProviderAccountId: "google-account-id",
      password: null,
    });

    const result = await deleteUserAction({
      ctx: createActionContext(),
      parsedInput: { confirmationEmail: user.email },
    } as any);

    expect(mocks.verifyUserPassword).not.toHaveBeenCalled();
    expect(mocks.consumeAccountDeletionSsoReauthentication).toHaveBeenCalledWith({
      identityProvider: "google",
      providerAccountId: "google-account-id",
      userId: user.id,
    });
    expect(mocks.deleteUser).toHaveBeenCalledWith(user.id);
    expect(result).toEqual({ success: true });
  });

  test("preserves the single-owner organization guard", async () => {
    mocks.getIsMultiOrgEnabled.mockResolvedValueOnce(false);
    mocks.getOrganizationsWhereUserIsSingleOwner.mockResolvedValueOnce([{ id: "org-id" }]);

    await expect(
      deleteUserAction({
        ctx: createActionContext(),
        parsedInput: { confirmationEmail: user.email, password: "correct-password" },
      } as any)
    ).rejects.toThrow(OperationNotAllowedError);

    expect(mocks.deleteUser).not.toHaveBeenCalled();
  });

  test("rate-limits malformed SSO reauthentication starts before parsing the payload", async () => {
    const rateLimitError = new TooManyRequestsError("Maximum number of requests reached");
    mocks.applyRateLimit.mockRejectedValueOnce(rateLimitError);

    await expect(
      startAccountDeletionSsoReauthenticationAction({
        ctx: createActionContext(),
        parsedInput: null,
      } as any)
    ).rejects.toThrow(TooManyRequestsError);

    expect(mocks.startAccountDeletionSsoReauthentication).not.toHaveBeenCalled();
  });

  test("rejects malformed SSO reauthentication start payloads after rate limiting", async () => {
    await expect(
      startAccountDeletionSsoReauthenticationAction({
        ctx: createActionContext(),
        parsedInput: { confirmationEmail: user.email },
      } as any)
    ).rejects.toThrow(InvalidInputError);

    expect(mocks.applyRateLimit).toHaveBeenCalled();
    expect(mocks.startAccountDeletionSsoReauthentication).not.toHaveBeenCalled();
  });

  test("starts SSO reauthentication with the authenticated user id", async () => {
    const result = await startAccountDeletionSsoReauthenticationAction({
      ctx: createActionContext(),
      parsedInput: {
        confirmationEmail: user.email.toUpperCase(),
        returnToUrl: "http://localhost:3000/environments/env-1/settings/profile",
      },
    } as any);

    expect(mocks.startAccountDeletionSsoReauthentication).toHaveBeenCalledWith({
      confirmationEmail: user.email.toUpperCase(),
      returnToUrl: "http://localhost:3000/environments/env-1/settings/profile",
      userId: user.id,
    });
    expect(result).toEqual({
      authorizationParams: { login_hint: user.email, max_age: "0", prompt: "login" },
      callbackUrl: "http://localhost:3000/auth/account-deletion/sso/complete?intent=intent-token",
      provider: "google",
    });
  });
});
