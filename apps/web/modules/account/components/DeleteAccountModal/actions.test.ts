import * as Sentry from "@sentry/nextjs";
import { getServerSession } from "next-auth";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { logger } from "@formbricks/logger";
import { TUser } from "@formbricks/types/user";
import { getOrganizationsWhereUserIsSingleOwner } from "@/lib/organization/service";
import { verifyUserPassword } from "@/lib/user/password";
import { deleteUser, getUser } from "@/lib/user/service";
import { applyRateLimit } from "@/modules/core/rate-limit/helpers";
import { getIsMultiOrgEnabled } from "@/modules/ee/license-check/lib/utils";
import { deleteUserAction } from "./actions";

vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
}));

vi.mock("@formbricks/logger", () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    withContext: () => ({ error: vi.fn() }),
  },
}));

vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}));

vi.mock("@/modules/auth/lib/authOptions", () => ({
  authOptions: {},
}));

vi.mock("@/lib/constants", () => ({
  AUDIT_LOG_ENABLED: false,
  AUDIT_LOG_GET_USER_IP: false,
}));

vi.mock("@/modules/ee/audit-logs/types/audit-log", () => ({
  UNKNOWN_DATA: "unknown",
}));

vi.mock("@/lib/user/service", () => ({
  deleteUser: vi.fn(),
  getUser: vi.fn(),
}));

vi.mock("@/lib/user/password", () => ({
  verifyUserPassword: vi.fn(),
}));

vi.mock("@/lib/organization/service", () => ({
  getOrganizationsWhereUserIsSingleOwner: vi.fn(),
}));

vi.mock("@/modules/core/rate-limit/helpers", () => ({
  applyRateLimit: vi.fn(),
}));

vi.mock("@/modules/ee/license-check/lib/utils", () => ({
  getIsMultiOrgEnabled: vi.fn(),
}));

const mockUser = {
  id: "user-1",
  name: "Test User",
  email: "test@example.com",
  emailVerified: new Date("2026-01-01"),
  twoFactorEnabled: false,
  identityProvider: "email",
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
  notificationSettings: { alert: {} },
  locale: "en-US",
  lastLoginAt: new Date("2026-01-01"),
  isActive: true,
} satisfies TUser;

describe("deleteUserAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: mockUser.id } });
    vi.mocked(getUser).mockResolvedValue(mockUser);
    vi.mocked(applyRateLimit).mockResolvedValue({ allowed: true });
    vi.mocked(getIsMultiOrgEnabled).mockResolvedValue(false);
    vi.mocked(getOrganizationsWhereUserIsSingleOwner).mockResolvedValue([]);
    vi.mocked(verifyUserPassword).mockResolvedValue(true);
    vi.mocked(deleteUser).mockResolvedValue(mockUser);
  });

  test("rejects replayed calls without password confirmation", async () => {
    const result = await deleteUserAction(undefined);

    expect(result?.serverError).toBe("Password and email confirmation are required to delete your account.");
    expect(applyRateLimit).toHaveBeenCalledWith(
      expect.objectContaining({ namespace: "action:account-delete" }),
      mockUser.id
    );
    expect(verifyUserPassword).not.toHaveBeenCalled();
    expect(deleteUser).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.any(Error),
        userId: mockUser.id,
      }),
      "Account deletion failed"
    );
    expect(Sentry.captureException).not.toHaveBeenCalled();
  });

  test("rejects mismatched email confirmation", async () => {
    const result = await deleteUserAction({
      confirmationEmail: "someone-else@example.com",
      password: "Password123",
    });

    expect(result?.serverError).toBe("Email confirmation does not match");
    expect(applyRateLimit).toHaveBeenCalledWith(
      expect.objectContaining({ namespace: "action:account-delete" }),
      mockUser.id
    );
    expect(verifyUserPassword).not.toHaveBeenCalled();
    expect(deleteUser).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.any(Error),
        userId: mockUser.id,
      }),
      "Account deletion failed"
    );
  });

  test("blocks SSO users because provider reauthentication is not available", async () => {
    vi.mocked(getUser).mockResolvedValue({
      ...mockUser,
      identityProvider: "google",
    });

    const result = await deleteUserAction({
      confirmationEmail: "test@example.com",
      password: "Password123",
    });

    expect(result?.serverError).toBe(
      "Account deletion for external sign-in accounts requires reauthentication with the identity provider and is not available here. Please contact your administrator or support to delete this account."
    );
    expect(applyRateLimit).toHaveBeenCalledWith(
      expect.objectContaining({ namespace: "action:account-delete" }),
      mockUser.id
    );
    expect(verifyUserPassword).not.toHaveBeenCalled();
    expect(deleteUser).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.any(Error),
        userId: mockUser.id,
      }),
      "Account deletion failed"
    );
  });

  test("rejects incorrect passwords", async () => {
    vi.mocked(verifyUserPassword).mockResolvedValue(false);

    const result = await deleteUserAction({
      confirmationEmail: "test@example.com",
      password: "WrongPassword123",
    });

    expect(result?.serverError).toBe("Incorrect credentials");
    expect(verifyUserPassword).toHaveBeenCalledWith(mockUser.id, "WrongPassword123");
    expect(deleteUser).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.any(Error),
        userId: mockUser.id,
      }),
      "Account deletion failed"
    );
  });

  test("blocks deletion when the user is the only owner and multi-org is disabled", async () => {
    vi.mocked(getOrganizationsWhereUserIsSingleOwner).mockResolvedValue([
      { id: "org-1", name: "Acme" } as any,
    ]);

    const result = await deleteUserAction({
      confirmationEmail: "test@example.com",
      password: "Password123",
    });

    expect(result?.serverError).toBe(
      "You are the only owner of this organization. Please transfer ownership to another member first."
    );
    expect(deleteUser).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.any(Error),
        userId: mockUser.id,
      }),
      "Account deletion failed"
    );
  });

  test("skips single-owner organization lookup when multi-org is enabled", async () => {
    vi.mocked(getIsMultiOrgEnabled).mockResolvedValue(true);

    const result = await deleteUserAction({
      confirmationEmail: "test@example.com",
      password: "Password123",
    });

    expect(result?.data).toEqual({ success: true });
    expect(getOrganizationsWhereUserIsSingleOwner).not.toHaveBeenCalled();
    expect(deleteUser).toHaveBeenCalledWith(mockUser.id);
  });

  test("deletes the authenticated user after confirmation and password re-authentication", async () => {
    const result = await deleteUserAction({
      confirmationEmail: " TEST@example.com ",
      password: "Password123",
    });

    expect(result?.data).toEqual({ success: true });
    expect(applyRateLimit).toHaveBeenCalledWith(
      expect.objectContaining({ namespace: "action:account-delete" }),
      mockUser.id
    );
    expect(verifyUserPassword).toHaveBeenCalledWith(mockUser.id, "Password123");
    expect(deleteUser).toHaveBeenCalledWith(mockUser.id);
    expect(logger.error).not.toHaveBeenCalled();
  });
});
