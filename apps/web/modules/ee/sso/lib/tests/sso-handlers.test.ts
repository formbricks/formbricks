import { createBrevoCustomer } from "@/modules/auth/lib/brevo";
import { createUser, getUserByEmail, updateUser } from "@/modules/auth/lib/user";
import { getIsSamlSsoEnabled, getisSsoEnabled } from "@/modules/ee/license-check/lib/utils";
import { Organization } from "@prisma/client";
import type { Account } from "next-auth";
import { ProviderType } from "next-auth/providers/index";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { createAccount } from "@formbricks/lib/account/service";
import { createMembership } from "@formbricks/lib/membership/service";
import { createOrganization, getOrganization } from "@formbricks/lib/organization/service";
import { findMatchingLocale } from "@formbricks/lib/utils/locale";
import type { TUser } from "@formbricks/types/user";
import { handleSSOCallback } from "../sso-handlers";

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
}));

describe("handleSSOCallback", () => {
  // Setup common test data
  const mockUser: TUser = {
    id: "user-123",
    email: "test@example.com",
    name: "Test User",
    notificationSettings: {
      alert: {},
      weeklySummary: {},
    },
    createdAt: new Date(),
    updatedAt: new Date(),
    twoFactorEnabled: false,
    emailVerified: new Date(),
    imageUrl: null,
    role: "other",
    objective: null,
    locale: "en-US",
    identityProvider: "email",
  };

  const mockAccount: Account = {
    provider: "google",
    type: "oauth",
    providerAccountId: "provider-123",
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock implementations
    vi.mocked(getisSsoEnabled).mockResolvedValue(true);
    vi.mocked(getIsSamlSsoEnabled).mockResolvedValue(true);
    vi.mocked(findMatchingLocale).mockResolvedValue("en-US");
  });

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
    const nonOauthAccount = { ...mockAccount, type: "credentials" as ProviderType };

    const result = await handleSSOCallback({ user: mockUser, account: nonOauthAccount });

    expect(result).toBe(false);
  });

  it("should return false if provider is SAML and SAML SSO is not enabled", async () => {
    const samlAccount = { ...mockAccount, provider: "saml" };
    vi.mocked(getIsSamlSsoEnabled).mockResolvedValue(false);

    const result = await handleSSOCallback({ user: mockUser, account: samlAccount });

    expect(result).toBe(false);
    expect(getIsSamlSsoEnabled).toHaveBeenCalled();
  });

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
      email: "new-email@example.com",
      emailVerified: new Date(),
      locale: "en-US",
    });

    await expect(handleSSOCallback({ user: mockUser, account: mockAccount })).rejects.toThrow(
      "Looks like you updated your email somewhere else. A user with this new email exists already."
    );
  });

  it("should return true if user with email already exists", async () => {
    vi.mocked(prisma.user.findFirst).mockResolvedValue(null);
    vi.mocked(getUserByEmail).mockResolvedValue({
      id: "existing-user-id",
      email: "existing-email@example.com",
      emailVerified: new Date(),
      locale: "en-US",
    });

    const result = await handleSSOCallback({ user: mockUser, account: mockAccount });

    expect(result).toBe(true);
  });

  it("should create a new user if no existing user found", async () => {
    const newUser = {
      ...mockUser,
      emailVerified: expect.any(Date),
    };

    vi.mocked(prisma.user.findFirst).mockResolvedValue(null);
    vi.mocked(getUserByEmail).mockResolvedValue(null);
    vi.mocked(createUser).mockResolvedValue(newUser);
    vi.mocked(getOrganization).mockResolvedValue(null);
    vi.mocked(createOrganization).mockResolvedValue({
      id: "org-123",
      name: "Test User's Organization",
      createdAt: new Date(),
      updatedAt: new Date(),
      billing: {
        stripeCustomerId: null,
        plan: "free",
        period: "monthly",
        limits: {
          monthly: {
            responses: null,
            miu: null,
          },
          projects: null,
        },
        periodStart: new Date(),
      },
      isAIEnabled: false,
    });

    const result = await handleSSOCallback({ user: mockUser, account: mockAccount });

    expect(result).toBe(true);
    expect(createUser).toHaveBeenCalledWith({
      name: mockUser.name,
      email: mockUser.email,
      emailVerified: new Date(),
      identityProvider: mockAccount.provider.toLowerCase().replace("-", ""),
      identityProviderAccountId: mockAccount.providerAccountId,
      locale: "en-US",
    });
    expect(createBrevoCustomer).toHaveBeenCalledWith({ id: mockUser.id, email: mockUser.email });
  });

  it("should create organization and membership for new user when DEFAULT_ORGANIZATION_ID is set", async () => {
    const newUser = {
      ...mockUser,
      emailVerified: new Date(),
    };

    vi.mocked(prisma.user.findFirst).mockResolvedValue(null);
    vi.mocked(getUserByEmail).mockResolvedValue(null);
    vi.mocked(createUser).mockResolvedValue(newUser);
    vi.mocked(getOrganization).mockResolvedValue(null);
    vi.mocked(createOrganization).mockResolvedValue({
      id: "org-123",
      name: "Test User's Organization",
      createdAt: new Date(),
      updatedAt: new Date(),
      billing: {
        stripeCustomerId: null,
        plan: "free",
        period: "monthly",
        limits: { monthly: { responses: null, miu: null }, projects: null },
        periodStart: new Date(),
      },
      isAIEnabled: false,
    });
    const result = await handleSSOCallback({ user: mockUser, account: mockAccount });

    expect(result).toBe(true);
    expect(createOrganization).toHaveBeenCalledWith({
      id: "org-123",
      name: expect.stringContaining("Organization"),
    });
    expect(createMembership).toHaveBeenCalledWith("org-123", newUser.id, { role: "owner", accepted: true });
    expect(createAccount).toHaveBeenCalledWith({
      ...mockAccount,
      userId: newUser.id,
    });
    expect(updateUser).toHaveBeenCalledWith(newUser.id, {
      notificationSettings: expect.objectContaining({
        unsubscribedOrganizationIds: ["org-123"],
      }),
    });
  });

  it("should use existing organization if it exists", async () => {
    const newUser = {
      ...mockUser,
      emailVerified: expect.any(Date),
    };
    const existingOrg = {
      id: "org-123",
      name: "Existing Organization",
      createdAt: new Date(),
      updatedAt: new Date(),
      billing: {
        stripeCustomerId: null,
        plan: "free" as Organization["billing"]["plan"],
        period: "monthly" as Organization["billing"]["period"],
        limits: { monthly: { responses: null, miu: null }, projects: null },
        periodStart: new Date(),
      },
      isAIEnabled: false,
    };

    vi.mocked(prisma.user.findFirst).mockResolvedValue(null);
    vi.mocked(getUserByEmail).mockResolvedValue(null);
    vi.mocked(createUser).mockResolvedValue(newUser);
    vi.mocked(getOrganization).mockResolvedValue(existingOrg);

    const result = await handleSSOCallback({ user: mockUser, account: mockAccount });

    expect(result).toBe(true);
    expect(createOrganization).not.toHaveBeenCalled();
    expect(createMembership).toHaveBeenCalledWith(existingOrg.id, newUser.id, {
      role: "member",
      accepted: true,
    });
  });

  it("should handle OpenID provider name extraction", async () => {
    // Create a proper OpenID user with the TOidcNameFields properties
    const openIdUser = {
      ...mockUser,
      // These fields are expected by the OpenID handling code
      given_name: "John",
      family_name: "Doe",
      name: "",
    };

    const openIdAccount = {
      ...mockAccount,
      provider: "openid",
    };

    vi.mocked(prisma.user.findFirst).mockResolvedValue(null);
    vi.mocked(getUserByEmail).mockResolvedValue(null);
    vi.mocked(createUser).mockResolvedValue({
      ...openIdUser,
      name: "John Doe", // The handler should construct this name
    });
    vi.mocked(getOrganization).mockResolvedValue(null);
    vi.mocked(createOrganization).mockResolvedValue({
      id: "org-123",
      name: "John Doe's Organization",
      createdAt: new Date(),
      updatedAt: new Date(),
      billing: {
        stripeCustomerId: null,
        plan: "free",
        period: "monthly",
        limits: { monthly: { responses: null, miu: null }, projects: null },
        periodStart: new Date(),
      },
      isAIEnabled: false,
    });
    const result = await handleSSOCallback({ user: openIdUser, account: openIdAccount });

    expect(result).toBe(true);
    expect(createUser).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "John Doe",
        email: openIdUser.email,
        identityProvider: "openid",
      })
    );
  });
});
