import { beforeEach, describe, expect, test, vi } from "vitest";
import { getUserAuthenticationData } from "@/lib/user/password";
import {
  getAccountDeletionAuthRequirements,
  requiresPasswordConfirmationForAccountDeletion,
} from "./account-deletion-auth";

vi.mock("@/lib/user/password", () => ({
  getUserAuthenticationData: vi.fn(),
}));

const mockGetUserAuthenticationData = vi.mocked(getUserAuthenticationData);

describe("account deletion auth requirements", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  test("requires password confirmation for password-backed users", () => {
    expect(requiresPasswordConfirmationForAccountDeletion({ password: "hashed-password" })).toBe(true);
  });

  test("does not require password confirmation for SSO-only users", () => {
    expect(requiresPasswordConfirmationForAccountDeletion({ password: null })).toBe(false);
  });

  test("resolves account deletion requirements from user authentication data", async () => {
    mockGetUserAuthenticationData.mockResolvedValue({
      email: "user@example.com",
      identityProvider: "email",
      identityProviderAccountId: null,
      password: "hashed-password",
    } as any);

    await expect(getAccountDeletionAuthRequirements("user-id")).resolves.toEqual({
      requiresPasswordConfirmation: true,
    });

    expect(mockGetUserAuthenticationData).toHaveBeenCalledWith("user-id");
  });
});
