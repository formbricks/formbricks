import { createBrevoCustomer } from "@/modules/auth/lib/brevo";
import { createUser, getUserByEmail, updateUser } from "@/modules/auth/lib/user";
import { createTeamMembership } from "@/modules/auth/signup/lib/team";
import type { TSamlNameFields } from "@/modules/auth/types/auth";
import { getIsSamlSsoEnabled, getisSsoEnabled } from "@/modules/ee/license-check/lib/utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { createAccount } from "@formbricks/lib/account/service";
import { createMembership } from "@formbricks/lib/membership/service";
import { createOrganization, getOrganization } from "@formbricks/lib/organization/service";
import { findMatchingLocale } from "@formbricks/lib/utils/locale";
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

vi.mock("@/modules/ee/license-check/lib/utils", () => ({
  getIsSamlSsoEnabled: vi.fn(),
  getisSsoEnabled: vi.fn(),
  getIsMultiOrgEnabled: vi.fn().mockResolvedValue(true),
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
  ENCRYPTION_KEY: "test-encryption-key-32-chars-long",
}));

describe("handleSsoCallback", () => {
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

      const result = await handleSsoCallback({
        user: mockUser,
        account: mockAccount,
        callbackUrl: "http://localhost:3000",
      });

      expect(result).toBe(false);
    });

    it("should return false if user email is missing", async () => {
      const result = await handleSsoCallback({
        user: { ...mockUser, email: "" },
        account: mockAccount,
        callbackUrl: "http://localhost:3000",
      });

      expect(result).toBe(false);
    });

    it("should return false if account type is not oauth", async () => {
      const result = await handleSsoCallback({
        user: mockUser,
        account: { ...mockAccount, type: "credentials" },
        callbackUrl: "http://localhost:3000",
      });

      expect(result).toBe(false);
    });

    it("should return false if provider is SAML and SAML SSO is not enabled", async () => {
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
    it("should return true if user with account already exists and email is the same", async () => {
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

      const result = await handleSsoCallback({
        user: mockUser,
        account: mockAccount,
        callbackUrl: "http://localhost:3000",
      });

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

    it("should return true if user with email already exists", async () => {
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
    it("should create a new user if no existing user found", async () => {
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

    it("should create organization and membership for new user when DEFAULT_ORGANIZATION_ID is set", async () => {
      vi.mocked(prisma.user.findFirst).mockResolvedValue(null);
      vi.mocked(getUserByEmail).mockResolvedValue(null);
      vi.mocked(createUser).mockResolvedValue(mockCreatedUser());
      vi.mocked(getOrganization).mockResolvedValue(null);

      const result = await handleSsoCallback({
        user: mockUser,
        account: mockAccount,
        callbackUrl: "http://localhost:3000",
      });

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

      const result = await handleSsoCallback({
        user: mockUser,
        account: mockAccount,
        callbackUrl: "http://localhost:3000",
      });

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

      const result = await handleSsoCallback({
        user: openIdUser,
        account: mockOpenIdAccount,
        callbackUrl: "http://localhost:3000",
      });

      expect(result).toBe(true);
      expect(createUser).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Direct Name",
          email: openIdUser.email,
          emailVerified: expect.any(Date),
          identityProvider: "openid",
          identityProviderAccountId: mockOpenIdAccount.providerAccountId,
          locale: "en-US",
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

      const result = await handleSsoCallback({
        user: openIdUser,
        account: mockOpenIdAccount,
        callbackUrl: "http://localhost:3000",
      });

      expect(result).toBe(true);
      expect(createUser).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "John Doe",
          email: openIdUser.email,
          emailVerified: expect.any(Date),
          identityProvider: "openid",
          identityProviderAccountId: mockOpenIdAccount.providerAccountId,
          locale: "en-US",
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

      const result = await handleSsoCallback({
        user: openIdUser,
        account: mockOpenIdAccount,
        callbackUrl: "http://localhost:3000",
      });

      expect(result).toBe(true);
      expect(createUser).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "preferred.user",
          email: openIdUser.email,
          emailVerified: expect.any(Date),
          identityProvider: "openid",
          identityProviderAccountId: mockOpenIdAccount.providerAccountId,
          locale: "en-US",
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
          email: openIdUser.email,
          emailVerified: expect.any(Date),
          identityProvider: "openid",
          identityProviderAccountId: mockOpenIdAccount.providerAccountId,
          locale: "en-US",
        })
      );
    });
  });

  describe("SAML name handling", () => {
    it("should use samlUser.name when available", async () => {
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
          email: samlUser.email,
          emailVerified: expect.any(Date),
          identityProvider: "saml",
          identityProviderAccountId: mockSamlAccount.providerAccountId,
          locale: "en-US",
        })
      );
    });

    it("should use firstName + lastName when name is not available", async () => {
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
          email: samlUser.email,
          emailVerified: expect.any(Date),
          identityProvider: "saml",
          identityProviderAccountId: mockSamlAccount.providerAccountId,
          locale: "en-US",
        })
      );
    });
  });

  describe("Organization handling", () => {
    it("should handle invalid DEFAULT_ORGANIZATION_ID gracefully", async () => {
      vi.mocked(prisma.user.findFirst).mockResolvedValue(null);
      vi.mocked(getUserByEmail).mockResolvedValue(null);
      vi.mocked(createUser).mockResolvedValue(mockCreatedUser());
      vi.mocked(getOrganization).mockResolvedValue(null);
      vi.mocked(createOrganization).mockRejectedValue(new Error("Invalid organization ID"));

      await expect(
        handleSsoCallback({
          user: mockUser,
          account: mockAccount,
          callbackUrl: "http://localhost:3000",
        })
      ).rejects.toThrow("Invalid organization ID");

      expect(createOrganization).toHaveBeenCalled();
      expect(createMembership).not.toHaveBeenCalled();
    });

    it("should handle membership creation failure gracefully", async () => {
      vi.mocked(prisma.user.findFirst).mockResolvedValue(null);
      vi.mocked(getUserByEmail).mockResolvedValue(null);
      vi.mocked(createUser).mockResolvedValue(mockCreatedUser());
      vi.mocked(createMembership).mockRejectedValue(new Error("Failed to create membership"));

      await expect(
        handleSsoCallback({
          user: mockUser,
          account: mockAccount,
          callbackUrl: "http://localhost:3000",
        })
      ).rejects.toThrow("Failed to create membership");

      expect(createMembership).toHaveBeenCalled();
    });
  });

  describe("Error handling", () => {
    it("should handle prisma errors gracefully", async () => {
      vi.mocked(prisma.user.findFirst).mockRejectedValue(new Error("Database error"));

      await expect(
        handleSsoCallback({
          user: mockUser,
          account: mockAccount,
          callbackUrl: "http://localhost:3000",
        })
      ).rejects.toThrow("Database error");
    });

    it("should handle locale finding errors gracefully", async () => {
      vi.mocked(findMatchingLocale).mockRejectedValue(new Error("Locale error"));
      vi.mocked(prisma.user.findFirst).mockResolvedValue(null);
      vi.mocked(getUserByEmail).mockResolvedValue(null);
      vi.mocked(createUser).mockResolvedValue(mockCreatedUser());

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
