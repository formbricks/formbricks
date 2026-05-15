import { getServerSession } from "next-auth";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { logger } from "@formbricks/logger";
import { AuthorizationError } from "@formbricks/types/errors";
import { verifyAccountDeletionSsoReauthIntent } from "@/lib/jwt";
import { deleteUserWithAccountDeletionAuthorization } from "@/modules/account/lib/account-deletion";
import { queueAuditEventBackground } from "@/modules/ee/audit-logs/lib/handler";
import { completeAccountDeletionSsoReauthenticationAndGetRedirectPath } from "./account-deletion-sso-complete";

vi.mock("server-only", () => ({}));

vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}));

vi.mock("@formbricks/logger", () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock("@/lib/constants", () => ({
  IS_FORMBRICKS_CLOUD: false,
  WEBAPP_URL: "http://localhost:3000",
}));

vi.mock("@/lib/jwt", () => ({
  verifyAccountDeletionSsoReauthIntent: vi.fn(),
}));

vi.mock("@/modules/account/lib/account-deletion", () => ({
  deleteUserWithAccountDeletionAuthorization: vi.fn(),
}));

vi.mock("@/modules/auth/lib/authOptions", () => ({
  authOptions: {},
}));

vi.mock("@/modules/ee/audit-logs/lib/handler", () => ({
  queueAuditEventBackground: vi.fn(),
}));

const mockGetServerSession = vi.mocked(getServerSession);
const mockLoggerError = vi.mocked(logger.error);
const mockVerifyAccountDeletionSsoReauthIntent = vi.mocked(verifyAccountDeletionSsoReauthIntent);
const mockDeleteUserWithAccountDeletionAuthorization = vi.mocked(deleteUserWithAccountDeletionAuthorization);
const mockQueueAuditEventBackground = vi.mocked(queueAuditEventBackground);

const intent = {
  id: "intent-id",
  email: "delete-user@example.com",
  provider: "google",
  providerAccountId: "google-account-id",
  purpose: "account_deletion_sso_reauth" as const,
  returnToUrl: "http://localhost:3000/environments/env-id/settings/profile",
  userId: "user-id",
};

describe("completeAccountDeletionSsoReauthenticationAndGetRedirectPath", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockVerifyAccountDeletionSsoReauthIntent.mockReturnValue(intent);
    mockGetServerSession.mockResolvedValue({
      user: {
        email: intent.email,
        id: intent.userId,
      },
    } as any);
    mockDeleteUserWithAccountDeletionAuthorization.mockResolvedValue({
      oldUser: { id: intent.userId } as any,
    });
    mockQueueAuditEventBackground.mockResolvedValue(undefined);
  });

  test("returns login without deleting when the callback has no intent", async () => {
    await expect(completeAccountDeletionSsoReauthenticationAndGetRedirectPath({})).resolves.toBe(
      "/auth/login"
    );

    expect(mockVerifyAccountDeletionSsoReauthIntent).not.toHaveBeenCalled();
    expect(mockDeleteUserWithAccountDeletionAuthorization).not.toHaveBeenCalled();
    expect(mockQueueAuditEventBackground).not.toHaveBeenCalled();
  });

  test("deletes the account after a completed SSO reauthentication", async () => {
    await expect(
      completeAccountDeletionSsoReauthenticationAndGetRedirectPath({ intent: "intent-token" })
    ).resolves.toBe("/auth/login");

    expect(mockDeleteUserWithAccountDeletionAuthorization).toHaveBeenCalledWith({
      confirmationEmail: intent.email,
      userEmail: intent.email,
      userId: intent.userId,
    });
    expect(mockQueueAuditEventBackground).toHaveBeenCalledWith({
      action: "deleted",
      targetType: "user",
      userId: intent.userId,
      userType: "user",
      targetId: intent.userId,
      organizationId: "unknown",
      oldObject: { id: intent.userId },
      status: "success",
    });
  });

  test("does not delete when the callback session does not match the intent user", async () => {
    mockGetServerSession.mockResolvedValue({
      user: {
        email: "other@example.com",
        id: "other-user-id",
      },
    } as any);

    await expect(
      completeAccountDeletionSsoReauthenticationAndGetRedirectPath({ intent: "intent-token" })
    ).resolves.toBe("/environments/env-id/settings/profile");

    expect(mockDeleteUserWithAccountDeletionAuthorization).not.toHaveBeenCalled();
    expect(mockLoggerError).toHaveBeenCalledWith(
      { error: expect.any(AuthorizationError) },
      "Failed to complete account deletion after SSO reauth"
    );
  });

  test("keeps the post-deletion redirect if audit logging fails after deletion", async () => {
    mockQueueAuditEventBackground.mockRejectedValue(new Error("audit unavailable"));

    await expect(
      completeAccountDeletionSsoReauthenticationAndGetRedirectPath({ intent: "intent-token" })
    ).resolves.toBe("/auth/login");

    expect(mockDeleteUserWithAccountDeletionAuthorization).toHaveBeenCalled();
    expect(mockLoggerError).toHaveBeenCalledWith(
      { error: expect.any(Error) },
      "Failed to complete account deletion after SSO reauth"
    );
  });

  test("falls back to login when the intent return URL is not allowed", async () => {
    mockVerifyAccountDeletionSsoReauthIntent.mockReturnValue({
      ...intent,
      returnToUrl: "https://evil.example/settings/profile",
    });
    mockGetServerSession.mockResolvedValue({
      user: {
        email: "other@example.com",
        id: "other-user-id",
      },
    } as any);

    await expect(
      completeAccountDeletionSsoReauthenticationAndGetRedirectPath({ intent: ["intent-token"] })
    ).resolves.toBe("/auth/login");

    expect(mockDeleteUserWithAccountDeletionAuthorization).not.toHaveBeenCalled();
  });
});
