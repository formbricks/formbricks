import { Organization } from "@prisma/client";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import type { TUser } from "@formbricks/types/user";
import { upsertAccount } from "@/lib/account/service";
import { getIsFreshInstance } from "@/lib/instance/service";
import { createMembership } from "@/lib/membership/service";
import { createOrganization, getOrganization } from "@/lib/organization/service";
import { capturePostHogEvent } from "@/lib/posthog";
import { findMatchingLocale } from "@/lib/utils/locale";
import { createBrevoCustomer } from "@/modules/auth/lib/brevo";
import { createUser, getUserByEmail, updateUser } from "@/modules/auth/lib/user";
import type { TSamlNameFields } from "@/modules/auth/types/auth";
import {
  getAccessControlPermission,
  getIsMultiOrgEnabled,
  getIsSamlSsoEnabled,
  getIsSsoEnabled,
} from "@/modules/ee/license-check/lib/utils";
import { createDefaultTeamMembership, getOrganizationByTeamId } from "@/modules/ee/sso/lib/team";
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
  getIsSsoEnabled: vi.fn(),
  getAccessControlPermission: vi.fn(),
  getIsMultiOrgEnabled: vi.fn(),
}));

vi.mock("@formbricks/database", () => ({
  prisma: {
    $transaction: vi.fn(async (callback: (tx: Record<string, never>) => unknown) => await callback({})),
    account: {
      findUnique: vi.fn(),
    },
    user: {
      findFirst: vi.fn(),
      count: vi.fn(), // Add count mock for user
    },
  },
}));

vi.mock("@/lib/instance/service", () => ({
  getIsFreshInstance: vi.fn(),
}));

vi.mock("@/modules/ee/sso/lib/team", () => ({
  getOrganizationByTeamId: vi.fn(),
  createDefaultTeamMembership: vi.fn(),
}));

vi.mock("@/lib/account/service", () => ({
  upsertAccount: vi.fn(),
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
    debug: vi.fn(),
    withContext: (context: Record<string, unknown>) => {
      return {
        ...context,
        debug: vi.fn(),
      };
    },
  },
}));

// Mock environment variables
vi.mock("@/lib/constants", () => ({
  SKIP_INVITE_FOR_SSO: 0,
  DEFAULT_TEAM_ID: "team-123",
  DEFAULT_ORGANIZATION_ID: "org-123",
  ENCRYPTION_KEY: "test-encryption-key-32-chars-long",
  POSTHOG_KEY: undefined,
}));

vi.mock("@/lib/posthog", () => ({
  capturePostHogEvent: vi.fn(),
}));

describe("handleSsoCallback", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();

    // Default mock implementations
    vi.mocked(getIsSsoEnabled).mockResolvedValue(true);
    vi.mocked(getIsSamlSsoEnabled).mockResolvedValue(true);
    vi.mocked(findMatchingLocale).mockResolvedValue("en-US");
    vi.mocked(getIsMultiOrgEnabled).mockResolvedValue(true);
    vi.mocked(getIsFreshInstance).mockResolvedValue(true);

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
      vi.mocked(getIsSsoEnabled).mockResolvedValue(false);

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
      vi.mocked(prisma.account.findUnique).mockResolvedValue({
        user: {
          ...mockUser,
          email: mockUser.email,
        },
      } as any);

      const result = await handleSsoCallback({
        user: mockUser,
        account: mockAccount,
        callbackUrl: "http://localhost:3000",
      });

      expect(result).toBe(true);
      expect(prisma.account.findUnique).toHaveBeenCalledWith({
        where: {
          provider_providerAccountId: {
            provider: mockAccount.provider,
            providerAccountId: mockAccount.providerAccountId,
          },
        },
        select: {
          user: {
            select: {
              id: true,
              email: true,
              locale: true,
              emailVerified: true,
              isActive: true,
              identityProvider: true,
              identityProviderAccountId: true,
            },
          },
        },
      });
    });

    test("should not overwrite stored tokens when the provider omits them", async () => {
      vi.mocked(prisma.account.findUnique).mockResolvedValue({
        user: {
          ...mockUser,
          email: mockUser.email,
        },
      } as any);

      const result = await handleSsoCallback({
        user: mockUser,
        account: {
          ...mockAccount,
          access_token: undefined,
          refresh_token: undefined,
          expires_at: undefined,
          scope: undefined,
          token_type: undefined,
          id_token: undefined,
        },
        callbackUrl: "http://localhost:3000",
      });

      expect(result).toBe(true);
      expect(upsertAccount).toHaveBeenCalledWith(
        {
          userId: mockUser.id,
          type: mockAccount.type,
          provider: mockAccount.provider,
          providerAccountId: mockAccount.providerAccountId,
        },
        undefined
      );
    });

    test("should update user email if user with account exists but email changed", async () => {
      const existingUser = {
        ...mockUser,
        id: "existing-user-id",
        email: "old-email@example.com",
      };

      vi.mocked(prisma.account.findUnique).mockResolvedValue({ user: existingUser } as any);
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
      };

      vi.mocked(prisma.account.findUnique).mockResolvedValue({ user: existingUser } as any);
      vi.mocked(getUserByEmail).mockResolvedValue({
        id: "another-user-id",
        email: mockUser.email,
        emailVerified: mockUser.emailVerified,
        identityProvider: "google",
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

    test("should backfill the account row for legacy linked SSO users", async () => {
      vi.mocked(prisma.account.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.user.findFirst).mockResolvedValue({
        ...mockUser,
        identityProvider: "google",
        identityProviderAccountId: mockAccount.providerAccountId,
      } as any);

      const result = await handleSsoCallback({
        user: mockUser,
        account: mockAccount,
        callbackUrl: "http://localhost:3000",
      });

      expect(result).toBe(true);
      expect(upsertAccount).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: mockUser.id,
          provider: mockAccount.provider,
          providerAccountId: mockAccount.providerAccountId,
        }),
        undefined
      );
    });

    test("should reject verified email users whose SSO provider is not already linked", async () => {
      vi.mocked(prisma.user.findFirst).mockResolvedValue(null);
      vi.mocked(getUserByEmail).mockResolvedValue({
        id: "existing-user-id",
        email: mockUser.email,
        emailVerified: new Date(),
        identityProvider: "email",
        locale: mockUser.locale,
        isActive: true,
      });

      await expect(
        handleSsoCallback({
          user: mockUser,
          account: mockAccount,
          callbackUrl: "http://localhost:3000",
        })
      ).rejects.toThrow("OAuthAccountNotLinked");
      expect(upsertAccount).not.toHaveBeenCalled();
      expect(updateUser).not.toHaveBeenCalled();
      expect(createUser).not.toHaveBeenCalled();
      expect(createMembership).not.toHaveBeenCalled();
      expect(createBrevoCustomer).not.toHaveBeenCalled();
      expect(capturePostHogEvent).not.toHaveBeenCalled();
    });

    test("should reject unverified email users whose SSO provider is not already linked", async () => {
      vi.mocked(prisma.account.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.user.findFirst).mockResolvedValue(null);
      vi.mocked(getUserByEmail).mockResolvedValue({
        id: "existing-user-id",
        email: mockUser.email,
        emailVerified: null,
        identityProvider: "email",
        locale: mockUser.locale,
        isActive: true,
      });

      await expect(
        handleSsoCallback({
          user: mockUser,
          account: mockAccount,
          callbackUrl: "http://localhost:3000",
        })
      ).rejects.toThrow("OAuthAccountNotLinked");
      expect(upsertAccount).not.toHaveBeenCalled();
      expect(updateUser).not.toHaveBeenCalled();
      expect(createUser).not.toHaveBeenCalled();
      expect(createMembership).not.toHaveBeenCalled();
      expect(createBrevoCustomer).not.toHaveBeenCalled();
      expect(capturePostHogEvent).not.toHaveBeenCalled();
    });

    test("should reject existing users from a different SSO provider when no link exists", async () => {
      vi.mocked(prisma.account.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.user.findFirst).mockResolvedValue(null);
      vi.mocked(getUserByEmail).mockResolvedValue({
        id: "existing-user-id",
        email: mockUser.email,
        emailVerified: new Date(),
        identityProvider: "github",
        locale: mockUser.locale,
        isActive: true,
      });

      await expect(
        handleSsoCallback({
          user: mockUser,
          account: mockAccount,
          callbackUrl: "http://localhost:3000",
        })
      ).rejects.toThrow("OAuthAccountNotLinked");
      expect(upsertAccount).not.toHaveBeenCalled();
      expect(updateUser).not.toHaveBeenCalled();
      expect(createUser).not.toHaveBeenCalled();
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
      expect(createUser).toHaveBeenCalledWith(
        {
          name: mockUser.name,
          email: mockUser.email,
          emailVerified: expect.any(Date),
          identityProvider: mockAccount.provider.toLowerCase().replace("-", ""),
          identityProviderAccountId: mockAccount.providerAccountId,
          locale: "en-US",
        },
        expect.anything()
      );
      expect(createBrevoCustomer).toHaveBeenCalledWith({ id: mockUser.id, email: mockUser.email });
    });

    test("should capture user_signed_up PostHog event for new SSO user", async () => {
      vi.mocked(prisma.user.findFirst).mockResolvedValue(null);
      vi.mocked(getUserByEmail).mockResolvedValue(null);
      vi.mocked(createUser).mockResolvedValue(mockCreatedUser());

      await handleSsoCallback({
        user: mockUser,
        account: mockAccount,
        callbackUrl: "http://localhost:3000",
      });

      expect(capturePostHogEvent).toHaveBeenCalledWith(mockUser.id, "user_signed_up", {
        auth_provider: mockAccount.provider,
        email_domain: "example.com",
        signup_source: "direct",
        invite_organization_id: null,
      });
    });

    test("should capture user_signed_up with invite signup_source when callbackUrl has token", async () => {
      vi.mocked(prisma.user.findFirst).mockResolvedValue(null);
      vi.mocked(getUserByEmail).mockResolvedValue(null);
      vi.mocked(createUser).mockResolvedValue(mockCreatedUser());
      vi.mocked(getOrganizationByTeamId).mockResolvedValue(mockOrganization as unknown as Organization);
      vi.mocked(getAccessControlPermission).mockResolvedValue(true);

      await handleSsoCallback({
        user: mockUser,
        account: mockAccount,
        callbackUrl: "http://localhost:3000?token=invite-token",
      });

      expect(capturePostHogEvent).toHaveBeenCalledWith(
        mockUser.id,
        "user_signed_up",
        expect.objectContaining({
          signup_source: "invite",
        })
      );
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
      expect(getAccessControlPermission).not.toHaveBeenCalled();
    });

    test("should return true when organization exists but role management is not enabled", async () => {
      vi.mocked(prisma.user.findFirst).mockResolvedValue(null);
      vi.mocked(getUserByEmail).mockResolvedValue(null);
      vi.mocked(createUser).mockResolvedValue(mockCreatedUser());
      vi.mocked(getOrganizationByTeamId).mockResolvedValue(mockOrganization as unknown as Organization);
      vi.mocked(getAccessControlPermission).mockResolvedValue(false);

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
        }),
        expect.anything()
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
        }),
        expect.anything()
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
        }),
        expect.anything()
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
        }),
        expect.anything()
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
        }),
        expect.anything()
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
        }),
        expect.anything()
      );
    });
  });

  describe("Auto-provisioning and invite handling", () => {
    test("should return false when auto-provisioning is disabled and no callback URL or multi-org", async () => {
      vi.resetModules();

      vi.mocked(getIsFreshInstance).mockResolvedValue(false);
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

    test("should not trigger signup side effects when transactional provisioning fails", async () => {
      vi.mocked(prisma.user.findFirst).mockResolvedValue(null);
      vi.mocked(getUserByEmail).mockResolvedValue(null);
      vi.mocked(createUser).mockRejectedValue(new Error("Create user failed"));

      await expect(
        handleSsoCallback({
          user: mockUser,
          account: mockAccount,
          callbackUrl: "http://localhost:3000",
        })
      ).rejects.toThrow("Create user failed");

      expect(createBrevoCustomer).not.toHaveBeenCalled();
      expect(capturePostHogEvent).not.toHaveBeenCalled();
    });
  });
});
