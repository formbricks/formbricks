import { beforeEach, describe, expect, test, vi } from "vitest";
import { AuthorizationError } from "@formbricks/types/errors";
import { ACCOUNT_DELETION_SSO_REAUTH_REQUIRED_ERROR_CODE } from "@/modules/account/constants";
import { deleteUserAction } from "./actions";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({
  applyRateLimit: vi.fn(),
  capturePostHogEvent: vi.fn(),
  deleteUserWithAccountDeletionAuthorization: vi.fn(),
  loggerError: vi.fn(),
  queueAuditEventBackground: vi.fn(),
  startAccountDeletionSsoReauthentication: vi.fn(),
}));

vi.mock("@formbricks/logger", () => ({
  logger: {
    error: mocks.loggerError,
  },
}));

vi.mock("@/lib/constants", () => ({
  WEBAPP_URL: "http://localhost:3000",
}));

vi.mock("@/lib/posthog", () => ({
  capturePostHogEvent: mocks.capturePostHogEvent,
}));

vi.mock("@/lib/utils/action-client", () => ({
  authenticatedActionClient: {
    inputSchema: vi.fn(() => ({
      action: vi.fn((fn) => fn),
    })),
  },
}));

vi.mock("@/modules/account/lib/account-deletion", () => ({
  deleteUserWithAccountDeletionAuthorization: mocks.deleteUserWithAccountDeletionAuthorization,
}));

vi.mock("@/modules/account/lib/account-deletion-sso-reauth", () => ({
  startAccountDeletionSsoReauthentication: mocks.startAccountDeletionSsoReauthentication,
}));

vi.mock("@/modules/core/rate-limit/helpers", () => ({
  applyRateLimit: mocks.applyRateLimit,
}));

vi.mock("@/modules/core/rate-limit/rate-limit-configs", () => ({
  rateLimitConfigs: {
    actions: {
      accountDeletion: "account-deletion-rate-limit",
    },
  },
}));

vi.mock("@/modules/ee/audit-logs/lib/handler", () => ({
  queueAuditEventBackground: mocks.queueAuditEventBackground,
}));

vi.mock("@/modules/ee/audit-logs/types/audit-log", () => ({
  UNKNOWN_DATA: "unknown",
}));

const ctx = {
  auditLoggingCtx: {
    eventId: "event-id",
  },
  user: {
    email: "sso-user@example.com",
    id: "user-id",
  },
};

const parsedInput = {
  confirmationEmail: "sso-user@example.com",
  returnToUrl: "http://localhost:3000/environments/env-id/settings/profile",
};

describe("deleteUserAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.applyRateLimit.mockResolvedValue(undefined);
    mocks.queueAuditEventBackground.mockResolvedValue(undefined);
  });

  test("returns SSO confirmation details without auditing a failed deletion for the normal redirect flow", async () => {
    const ssoConfirmation = {
      authorizationParams: { login_hint: "sso-user@example.com" },
      callbackUrl: "http://localhost:3000/auth/account-deletion/sso/complete?intent=intent-token",
      provider: "google",
    };
    mocks.deleteUserWithAccountDeletionAuthorization.mockRejectedValueOnce(
      new AuthorizationError(ACCOUNT_DELETION_SSO_REAUTH_REQUIRED_ERROR_CODE)
    );
    mocks.startAccountDeletionSsoReauthentication.mockResolvedValueOnce(ssoConfirmation);

    await expect(deleteUserAction({ ctx, parsedInput })).resolves.toEqual({ ssoConfirmation });

    expect(mocks.startAccountDeletionSsoReauthentication).toHaveBeenCalledWith({
      confirmationEmail: parsedInput.confirmationEmail,
      returnToUrl: parsedInput.returnToUrl,
      userId: ctx.user.id,
    });
    expect(mocks.queueAuditEventBackground).not.toHaveBeenCalled();
  });

  test("queues a success audit event only after the user is deleted", async () => {
    const oldUser = { email: ctx.user.email, id: ctx.user.id };
    mocks.deleteUserWithAccountDeletionAuthorization.mockResolvedValueOnce({ oldUser });

    await expect(deleteUserAction({ ctx, parsedInput })).resolves.toEqual({ success: true });

    expect(mocks.queueAuditEventBackground).toHaveBeenCalledWith({
      action: "deleted",
      targetType: "user",
      userId: ctx.user.id,
      userType: "user",
      targetId: ctx.user.id,
      organizationId: "unknown",
      oldObject: oldUser,
      status: "success",
    });
    expect(mocks.capturePostHogEvent).toHaveBeenCalledWith(ctx.user.id, "delete_account");
  });

  test("queues a failure audit event for real deletion failures", async () => {
    const error = new Error("delete failed");
    mocks.deleteUserWithAccountDeletionAuthorization.mockRejectedValueOnce(error);

    await expect(deleteUserAction({ ctx, parsedInput })).rejects.toThrow(error);

    expect(mocks.queueAuditEventBackground).toHaveBeenCalledWith({
      action: "deleted",
      targetType: "user",
      userId: ctx.user.id,
      userType: "user",
      targetId: ctx.user.id,
      organizationId: "unknown",
      oldObject: undefined,
      status: "failure",
      eventId: ctx.auditLoggingCtx.eventId,
    });
  });
});
