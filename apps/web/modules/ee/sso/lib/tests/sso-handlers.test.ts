import { createBrevoCustomer } from "@/modules/auth/lib/brevo";
import { createUser, getUserByEmail, updateUser } from "@/modules/auth/lib/user";
import { createTeamMembership } from "@/modules/auth/signup/lib/team";
import { getIsSamlSsoEnabled, getisSsoEnabled } from "@/modules/ee/license-check/lib/utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { createAccount } from "@formbricks/lib/account/service";
import { createMembership } from "@formbricks/lib/membership/service";
import { createOrganization, getOrganization } from "@formbricks/lib/organization/service";
import { findMatchingLocale } from "@formbricks/lib/utils/locale";
import { handleSSOCallback } from "../sso-handlers";
import {
  mockAccount,
  mockCreatedUser,
  mockOpenIdAccount,
  mockOpenIdUser,
  mockOrganization,
  mockSamlAccount,
  mockUser,
} from "./__mock__/sso-handlers.mock";

// Mock all dependencies
vi.mock("@/modules/auth/lib/brevo", () => ({
  createBrevoCustomer: vi.fn(),
}));

vi.mock("@/modules/auth/lib/user", () => ({
  getUserByEmail: vi.fn(),
  updateUser: vi.fn(),
  createUser: vi.fn(),
}));

vi.mock("@/modules/ee/license-check/lib/utils", () => ({
  getIsSamlSsoEnabled: vi.fn(),
  getisSsoEnabled: vi.fn(),
}));

vi.mock("@formbricks/database", () => ({
  prisma: {
    user: {
      findFirst: vi.fn(),
    },
  },
}));

vi.mock("@/modules/auth/signup/lib/team", () => ({
  createTeamMembership: vi.fn(),
  createDefaultTeamMembership: vi.fn(),
}));

vi.mock("@formbricks/lib/account/service", () => ({
  createAccount: vi.fn(),
}));

vi.mock("@formbricks/lib/membership/service", () => ({
  createMembership: vi.fn(),
}));

vi.mock("@formbricks/lib/organization/service", () => ({
  createOrganization: vi.fn(),
  getOrganization: vi.fn(),
}));

vi.mock("@formbricks/lib/utils/locale", () => ({
  findMatchingLocale: vi.fn(),
}));

// Mock environment variables
vi.mock("@formbricks/lib/constants", () => ({
  DEFAULT_ORGANIZATION_ID: "org-123",
  DEFAULT_ORGANIZATION_ROLE: "member",
  DEFAULT_TEAM_ID: "team-123",
}));

describe("handleSSOCallback", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock implementations
    vi.mocked(getisSsoEnabled).mockResolvedValue(true);
    vi.mocked(getIsSamlSsoEnabled).mockResolvedValue(true);
    vi.mocked(findMatchingLocale).mockResolvedValue("en-US");

    // Mock organization-related functions
    vi.mocked(getOrganization).mockResolvedValue(mockOrganization);
    vi.mocked(createOrganization).mockResolvedValue(mockOrganization);
    vi.mocked(createMembership).mockResolvedValue({
      role: "member",
      accepted: true,
      userId: mockUser.id,
      organizationId: mockOrganization.id,
    });
    vi.mocked(updateUser).mockResolvedValue({ ...mockUser, id: "user-123" });
  });

  describe("Early return conditions", () => {
    it("should return false if SSO is not enabled", async () => {
      vi.mocked(getisSsoEnabled).mockResolvedValue(false);

      const result = await handleSSOCallback({ user: mockUser, account: mockAccount });

      expect(result).toBe(false);
      expect(getisSsoEnabled).toHaveBeenCalled();
    });

    it("should return false if user email is missing", async () => {
      const userWithoutEmail = { ...mockUser, email: "" };

      const result = await handleSSOCallback({ user: userWithoutEmail, account: mockAccount });

      expect(result).toBe(false);
    });

    it("should return false if account type is not oauth", async () => {
      const nonOauthAccount = { ...mockAccount, type: "credentials" as const };

      const result = await handleSSOCallback({ user: mockUser, account: nonOauthAccount });

      expect(result).toBe(false);
    });

    it("should return false if provider is SAML and SAML SSO is not enabled", async () => {
      vi.mocked(getIsSamlSsoEnabled).mockResolvedValue(false);

      const result = await handleSSOCallback({ user: mockUser, account: mockSamlAccount });

      expect(result).toBe(false);
      expect(getIsSamlSsoEnabled).toHaveBeenCalled();
    });
  });

  describe("Existing user handling", () => {
    it("should return true if user with account already exists and email is the same", async () => {
      vi.mocked(prisma.user.findFirst).mockResolvedValue({
        ...mockUser,
        email: mockUser.email,
        accounts: [{ provider: mockAccount.provider }],
      });

      const result = await handleSSOCallback({ user: mockUser, account: mockAccount });

      expect(result).toBe(true);
      expect(prisma.user.findFirst).toHaveBeenCalledWith({
        include: {
          accounts: {
            where: {
              provider: mockAccount.provider,
            },
          },
        },
        where: {
          identityProvider: mockAccount.provider.toLowerCase().replace("-", ""),
          identityProviderAccountId: mockAccount.providerAccountId,
        },
      });
    });

    it("should update user email if user with account exists but email changed", async () => {
      const existingUser = {
        ...mockUser,
        id: "existing-user-id",
        email: "old-email@example.com",
        accounts: [{ provider: mockAccount.provider }],
      };

      vi.mocked(prisma.user.findFirst).mockResolvedValue(existingUser);
      vi.mocked(getUserByEmail).mockResolvedValue(null);
      vi.mocked(updateUser).mockResolvedValue({ ...existingUser, email: mockUser.email });

      const result = await handleSSOCallback({ user: mockUser, account: mockAccount });

      expect(result).toBe(true);
      expect(updateUser).toHaveBeenCalledWith(existingUser.id, { email: mockUser.email });
    });

    it("should throw error if user with account exists, email changed, and another user has the new email", async () => {
      const existingUser = {
        ...mockUser,
        id: "existing-user-id",
        email: "old-email@example.com",
        accounts: [{ provider: mockAccount.provider }],
      };

      vi.mocked(prisma.user.findFirst).mockResolvedValue(existingUser);
      vi.mocked(getUserByEmail).mockResolvedValue({
        id: "another-user-id",
        email: mockUser.email,
        emailVerified: mockUser.emailVerified,
        locale: mockUser.locale,
      });

      await expect(handleSSOCallback({ user: mockUser, account: mockAccount })).rejects.toThrow(
        "Looks like you updated your email somewhere else. A user with this new email exists already."
      );
    });

    it("should return true if user with email already exists", async () => {
      vi.mocked(prisma.user.findFirst).mockResolvedValue(null);
      vi.mocked(getUserByEmail).mockResolvedValue({
        id: "existing-user-id",
        email: mockUser.email,
        emailVerified: mockUser.emailVerified,
        locale: mockUser.locale,
      });

      const result = await handleSSOCallback({ user: mockUser, account: mockAccount });

      expect(result).toBe(true);
    });
  });

  describe("New user creation", () => {
    it("should create a new user if no existing user found", async () => {
      vi.mocked(prisma.user.findFirst).mockResolvedValue(null);
      vi.mocked(getUserByEmail).mockResolvedValue(null);
      vi.mocked(createUser).mockResolvedValue(mockCreatedUser());

      const result = await handleSSOCallback({ user: mockUser, account: mockAccount });

      expect(result).toBe(true);
      expect(createUser).toHaveBeenCalledWith({
        name: mockUser.name,
        email: mockUser.email,
        emailVerified: expect.any(Date),
        identityProvider: mockAccount.provider.toLowerCase().replace("-", ""),
        identityProviderAccountId: mockAccount.providerAccountId,
        locale: "en-US",
      });
      expect(createBrevoCustomer).toHaveBeenCalledWith({ id: mockUser.id, email: mockUser.email });
    });

    it("should create organization and membership for new user when DEFAULT_ORGANIZATION_ID is set", async () => {
      vi.mocked(prisma.user.findFirst).mockResolvedValue(null);
      vi.mocked(getUserByEmail).mockResolvedValue(null);
      vi.mocked(createUser).mockResolvedValue(mockCreatedUser());
      vi.mocked(getOrganization).mockResolvedValue(null);

      const result = await handleSSOCallback({ user: mockUser, account: mockAccount });

      expect(result).toBe(true);
      expect(createOrganization).toHaveBeenCalledWith({
        id: "org-123",
        name: expect.stringContaining("Organization"),
      });
      expect(createMembership).toHaveBeenCalledWith("org-123", mockCreatedUser().id, {
        role: "owner",
        accepted: true,
      });
      expect(createAccount).toHaveBeenCalledWith({
        ...mockAccount,
        userId: mockCreatedUser().id,
      });
      expect(updateUser).toHaveBeenCalledWith(mockCreatedUser().id, {
        notificationSettings: expect.objectContaining({
          unsubscribedOrganizationIds: ["org-123"],
        }),
      });
    });

    it("should use existing organization if it exists", async () => {
      vi.mocked(prisma.user.findFirst).mockResolvedValue(null);
      vi.mocked(getUserByEmail).mockResolvedValue(null);
      vi.mocked(createUser).mockResolvedValue(mockCreatedUser());

      const result = await handleSSOCallback({ user: mockUser, account: mockAccount });

      expect(result).toBe(true);
      expect(createOrganization).not.toHaveBeenCalled();
      expect(createMembership).toHaveBeenCalledWith(mockOrganization.id, mockCreatedUser().id, {
        role: "member",
        accepted: true,
      });
    });
  });

  describe("OpenID Connect name handling", () => {
    it("should use oidcUser.name when available", async () => {
      const openIdUser = mockOpenIdUser({
        name: "Direct Name",
        given_name: "John",
        family_name: "Doe",
      });

      vi.mocked(createUser).mockResolvedValue(mockCreatedUser("Direct Name"));

      const result = await handleSSOCallback({ user: openIdUser, account: mockOpenIdAccount });

      expect(result).toBe(true);
      expect(createUser).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Direct Name",
          email: openIdUser.email,
          identityProvider: "openid",
        })
      );
    });

    it("should use given_name + family_name when name is not available", async () => {
      const openIdUser = mockOpenIdUser({
        name: undefined,
        given_name: "John",
        family_name: "Doe",
      });

      vi.mocked(createUser).mockResolvedValue(mockCreatedUser("John Doe"));

      const result = await handleSSOCallback({ user: openIdUser, account: mockOpenIdAccount });

      expect(result).toBe(true);
      expect(createUser).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "John Doe",
          email: openIdUser.email,
          identityProvider: "openid",
        })
      );
    });

    it("should use preferred_username when name and given_name/family_name are not available", async () => {
      const openIdUser = mockOpenIdUser({
        name: undefined,
        given_name: undefined,
        family_name: undefined,
        preferred_username: "preferred.user",
      });

      vi.mocked(createUser).mockResolvedValue(mockCreatedUser("preferred.user"));

      const result = await handleSSOCallback({ user: openIdUser, account: mockOpenIdAccount });

      expect(result).toBe(true);
      expect(createUser).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "preferred.user",
          email: openIdUser.email,
          identityProvider: "openid",
        })
      );
    });

    it("should fallback to email username when no OIDC name fields are available", async () => {
      const openIdUser = mockOpenIdUser({
        name: undefined,
        given_name: undefined,
        family_name: undefined,
        preferred_username: undefined,
        email: "test.user@example.com",
      });

      vi.mocked(createUser).mockResolvedValue(mockCreatedUser("test.user"));

      const result = await handleSSOCallback({ user: openIdUser, account: mockOpenIdAccount });

      expect(result).toBe(true);

      expect(createUser).toHaveBeenCalledWith(
        expect.objectContaining({
          email: openIdUser.email,
          identityProvider: "openid",
        })
      );
    });
  });
});
