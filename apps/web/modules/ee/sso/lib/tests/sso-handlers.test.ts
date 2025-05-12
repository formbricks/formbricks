import { createMembership } from "@/lib/membership/service";
import { createOrganization, getOrganization } from "@/lib/organization/service";
import { findMatchingLocale } from "@/lib/utils/locale";
import { createBrevoCustomer } from "@/modules/auth/lib/brevo";
import { createUser, getUserByEmail, updateUser } from "@/modules/auth/lib/user";
import type { TSamlNameFields } from "@/modules/auth/types/auth";
import {
  getIsMultiOrgEnabled,
  getIsSamlSsoEnabled,
  getRoleManagementPermission,
  getisSsoEnabled,
} from "@/modules/ee/license-check/lib/utils";
import { createDefaultTeamMembership, getOrganizationByTeamId } from "@/modules/ee/sso/lib/team";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import type { TUser } from "@formbricks/types/user";
import { handleSsoCallback } from "../sso-handlers";
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

vi.mock("@/modules/auth/signup/lib/invite", () => ({
  getIsValidInviteToken: vi.fn(),
}));

vi.mock("@/modules/ee/license-check/lib/utils", () => ({
  getIsSamlSsoEnabled: vi.fn(),
  getisSsoEnabled: vi.fn(),
  getRoleManagementPermission: vi.fn(),
  getIsMultiOrgEnabled: vi.fn(),
}));

vi.mock("@formbricks/database", () => ({
  prisma: {
    user: {
      findFirst: vi.fn(),
      count: vi.fn(), // Add count mock for user
    },
  },
}));

vi.mock("@/modules/ee/sso/lib/team", () => ({
  getOrganizationByTeamId: vi.fn(),
  createDefaultTeamMembership: vi.fn(),
}));

vi.mock("@/lib/account/service", () => ({
  createAccount: vi.fn(),
}));

vi.mock("@/lib/membership/service", () => ({
  createMembership: vi.fn(),
}));

vi.mock("@/lib/organization/service", () => ({
  createOrganization: vi.fn(),
  getOrganization: vi.fn(),
}));

vi.mock("@/lib/utils/locale", () => ({
  findMatchingLocale: vi.fn(),
}));

vi.mock("@formbricks/lib/jwt", () => ({
  verifyInviteToken: vi.fn(),
}));

vi.mock("@formbricks/logger", () => ({
  logger: {
    error: vi.fn(),
  },
}));

// Mock environment variables
vi.mock("@/lib/constants", () => ({
  SKIP_INVITE_FOR_SSO: 0,
  DEFAULT_TEAM_ID: "team-123",
  DEFAULT_ORGANIZATION_ID: "org-123",
  ENCRYPTION_KEY: "test-encryption-key-32-chars-long",
}));

describe("handleSsoCallback", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();

    // Default mock implementations
    vi.mocked(getisSsoEnabled).mockResolvedValue(true);
    vi.mocked(getIsSamlSsoEnabled).mockResolvedValue(true);
    vi.mocked(findMatchingLocale).mockResolvedValue("en-US");
    vi.mocked(getIsMultiOrgEnabled).mockResolvedValue(true);

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
    vi.mocked(createDefaultTeamMembership).mockResolvedValue(undefined);
  });

  describe("Early return conditions", () => {
    test("should return false if SSO is not enabled", async () => {
      vi.mocked(getisSsoEnabled).mockResolvedValue(false);

      const result = await handleSsoCallback({
        user: mockUser,
        account: mockAccount,
        callbackUrl: "http://localhost:3000",
      });

      expect(result).toBe(false);
    });

    test("should return false if user email is missing", async () => {
      const result = await handleSsoCallback({
        user: { ...mockUser, email: "" },
        account: mockAccount,
        callbackUrl: "http://localhost:3000",
      });

      expect(result).toBe(false);
    });

    test("should return false if account type is not oauth", async () => {
      const result = await handleSsoCallback({
        user: mockUser,
        account: { ...mockAccount, type: "credentials" },
        callbackUrl: "http://localhost:3000",
      });

      expect(result).toBe(false);
    });

    test("should return false if provider is SAML and SAML SSO is not enabled", async () => {
      vi.mocked(getIsSamlSsoEnabled).mockResolvedValue(false);

      const result = await handleSsoCallback({
        user: mockUser,
        account: mockSamlAccount,
        callbackUrl: "http://localhost:3000",
      });

      expect(result).toBe(false);
    });
  });

  describe("Existing user handling", () => {
    test("should return true if user with account already exists and email is the same", async () => {
      vi.mocked(prisma.user.findFirst).mockResolvedValue({
        ...mockUser,
        email: mockUser.email,
        accounts: [{ provider: mockAccount.provider }],
      });

      const result = await handleSsoCallback({
        user: mockUser,
        account: mockAccount,
        callbackUrl: "http://localhost:3000",
      });

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

    test("should update user email if user with account exists but email changed", async () => {
      const existingUser = {
        ...mockUser,
        id: "existing-user-id",
        email: "old-email@example.com",
        accounts: [{ provider: mockAccount.provider }],
      };

      vi.mocked(prisma.user.findFirst).mockResolvedValue(existingUser);
      vi.mocked(getUserByEmail).mockResolvedValue(null);
      vi.mocked(updateUser).mockResolvedValue({ ...existingUser, email: mockUser.email });

      const result = await handleSsoCallback({
        user: mockUser,
        account: mockAccount,
        callbackUrl: "http://localhost:3000",
      });

      expect(result).toBe(true);
      expect(updateUser).toHaveBeenCalledWith(existingUser.id, { email: mockUser.email });
    });

    test("should throw error if user with account exists, email changed, and another user has the new email", async () => {
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
        isActive: true,
      });

      await expect(
        handleSsoCallback({
          user: mockUser,
          account: mockAccount,
          callbackUrl: "http://localhost:3000",
        })
      ).rejects.toThrow(
        "Looks like you updated your email somewhere else. A user with this new email exists already."
      );
    });

    test("should return true if user with email already exists", async () => {
      vi.mocked(prisma.user.findFirst).mockResolvedValue(null);
      vi.mocked(getUserByEmail).mockResolvedValue({
        id: "existing-user-id",
        email: mockUser.email,
        emailVerified: mockUser.emailVerified,
        locale: mockUser.locale,
        isActive: true,
      });

      const result = await handleSsoCallback({
        user: mockUser,
        account: mockAccount,
        callbackUrl: "http://localhost:3000",
      });

      expect(result).toBe(true);
    });
  });

  describe("New user creation", () => {
    test("should create a new user if no existing user found", async () => {
      vi.mocked(prisma.user.findFirst).mockResolvedValue(null);
      vi.mocked(getUserByEmail).mockResolvedValue(null);
      vi.mocked(createUser).mockResolvedValue(mockCreatedUser());

      const result = await handleSsoCallback({
        user: mockUser,
        account: mockAccount,
        callbackUrl: "http://localhost:3000",
      });

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

    test("should return true when organization doesn't exist with DEFAULT_TEAM_ID", async () => {
      vi.mocked(prisma.user.findFirst).mockResolvedValue(null);
      vi.mocked(getUserByEmail).mockResolvedValue(null);
      vi.mocked(createUser).mockResolvedValue(mockCreatedUser());
      vi.mocked(getOrganizationByTeamId).mockResolvedValue(null);

      const result = await handleSsoCallback({
        user: mockUser,
        account: mockAccount,
        callbackUrl: "http://localhost:3000",
      });

      expect(result).toBe(true);
      expect(getRoleManagementPermission).not.toHaveBeenCalled();
    });

    test("should return true when organization exists but role management is not enabled", async () => {
      vi.mocked(prisma.user.findFirst).mockResolvedValue(null);
      vi.mocked(getUserByEmail).mockResolvedValue(null);
      vi.mocked(createUser).mockResolvedValue(mockCreatedUser());
      vi.mocked(getOrganizationByTeamId).mockResolvedValue(mockOrganization);
      vi.mocked(getRoleManagementPermission).mockResolvedValue(false);

      const result = await handleSsoCallback({
        user: mockUser,
        account: mockAccount,
        callbackUrl: "http://localhost:3000",
      });

      expect(result).toBe(true);
      expect(createMembership).not.toHaveBeenCalled();
    });
  });

  describe("OpenID Connect name handling", () => {
    test("should use oidcUser.name when available", async () => {
      vi.mocked(prisma.user.findFirst).mockResolvedValue(null);
      vi.mocked(getUserByEmail).mockResolvedValue(null);

      const openIdUser = mockOpenIdUser({
        name: "Direct Name",
        given_name: "John",
        family_name: "Doe",
      });

      vi.mocked(createUser).mockResolvedValue(mockCreatedUser("Direct Name"));

      const result = await handleSsoCallback({
        user: openIdUser,
        account: mockOpenIdAccount,
        callbackUrl: "http://localhost:3000",
      });

      expect(result).toBe(true);
      expect(createUser).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Direct Name",
        })
      );
    });

    test("should use given_name + family_name when name is not available", async () => {
      vi.mocked(prisma.user.findFirst).mockResolvedValue(null);
      vi.mocked(getUserByEmail).mockResolvedValue(null);

      const openIdUser = mockOpenIdUser({
        name: undefined,
        given_name: "John",
        family_name: "Doe",
      });

      vi.mocked(createUser).mockResolvedValue(mockCreatedUser("John Doe"));

      const result = await handleSsoCallback({
        user: openIdUser,
        account: mockOpenIdAccount,
        callbackUrl: "http://localhost:3000",
      });

      expect(result).toBe(true);
      expect(createUser).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "John Doe",
        })
      );
    });

    test("should use preferred_username when name and given_name/family_name are not available", async () => {
      vi.mocked(prisma.user.findFirst).mockResolvedValue(null);
      vi.mocked(getUserByEmail).mockResolvedValue(null);

      const openIdUser = mockOpenIdUser({
        name: undefined,
        given_name: undefined,
        family_name: undefined,
        preferred_username: "preferred.user",
      });

      vi.mocked(createUser).mockResolvedValue(mockCreatedUser("preferred.user"));

      const result = await handleSsoCallback({
        user: openIdUser,
        account: mockOpenIdAccount,
        callbackUrl: "http://localhost:3000",
      });

      expect(result).toBe(true);
      expect(createUser).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "preferred.user",
        })
      );
    });

    test("should fallback to email username when no OIDC name fields are available", async () => {
      vi.mocked(prisma.user.findFirst).mockResolvedValue(null);
      vi.mocked(getUserByEmail).mockResolvedValue(null);

      const openIdUser = mockOpenIdUser({
        name: undefined,
        given_name: undefined,
        family_name: undefined,
        preferred_username: undefined,
        email: "test.user@example.com",
      });

      vi.mocked(createUser).mockResolvedValue(mockCreatedUser("test user"));

      const result = await handleSsoCallback({
        user: openIdUser,
        account: mockOpenIdAccount,
        callbackUrl: "http://localhost:3000",
      });

      expect(result).toBe(true);
      expect(createUser).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "test user",
        })
      );
    });
  });

  describe("SAML name handling", () => {
    test("should use samlUser.name when available", async () => {
      vi.mocked(prisma.user.findFirst).mockResolvedValue(null);
      vi.mocked(getUserByEmail).mockResolvedValue(null);

      const samlUser = {
        ...mockUser,
        name: "Direct Name",
        firstName: "John",
        lastName: "Doe",
      } as TUser & TSamlNameFields;

      vi.mocked(createUser).mockResolvedValue(mockCreatedUser("Direct Name"));

      const result = await handleSsoCallback({
        user: samlUser,
        account: mockSamlAccount,
        callbackUrl: "http://localhost:3000",
      });

      expect(result).toBe(true);
      expect(createUser).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Direct Name",
        })
      );
    });

    test("should use firstName + lastName when name is not available", async () => {
      vi.mocked(prisma.user.findFirst).mockResolvedValue(null);
      vi.mocked(getUserByEmail).mockResolvedValue(null);

      const samlUser = {
        ...mockUser,
        name: "",
        firstName: "John",
        lastName: "Doe",
      } as TUser & TSamlNameFields;

      vi.mocked(createUser).mockResolvedValue(mockCreatedUser("John Doe"));

      const result = await handleSsoCallback({
        user: samlUser,
        account: mockSamlAccount,
        callbackUrl: "http://localhost:3000",
      });

      expect(result).toBe(true);
      expect(createUser).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "John Doe",
        })
      );
    });
  });

  describe("Auto-provisioning and invite handling", () => {
    test("should return false when auto-provisioning is disabled and no callback URL or multi-org", async () => {
      vi.resetModules();

      vi.mocked(prisma.user.findFirst).mockResolvedValue(null);
      vi.mocked(getUserByEmail).mockResolvedValue(null);
      vi.mocked(getIsMultiOrgEnabled).mockResolvedValue(false);

      const result = await handleSsoCallback({
        user: mockUser,
        account: mockAccount,
        callbackUrl: "",
      });

      expect(result).toBe(false);
    });
  });

  describe("Error handling", () => {
    test("should handle database errors", async () => {
      vi.mocked(prisma.user.findFirst).mockRejectedValue(new Error("Database error"));

      await expect(
        handleSsoCallback({
          user: mockUser,
          account: mockAccount,
          callbackUrl: "http://localhost:3000",
        })
      ).rejects.toThrow("Database error");
    });

    test("should handle locale finding errors", async () => {
      vi.mocked(findMatchingLocale).mockRejectedValue(new Error("Locale error"));
      vi.mocked(prisma.user.findFirst).mockResolvedValue(null);
      vi.mocked(getUserByEmail).mockResolvedValue(null);

      await expect(
        handleSsoCallback({
          user: mockUser,
          account: mockAccount,
          callbackUrl: "http://localhost:3000",
        })
      ).rejects.toThrow("Locale error");
    });
  });
});
