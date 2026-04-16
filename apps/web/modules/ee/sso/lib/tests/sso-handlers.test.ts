import { Organization } from "@prisma/client";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { getIsFreshInstance } from "@/lib/instance/service";
import { createMembership } from "@/lib/membership/service";
import { capturePostHogEvent } from "@/lib/posthog";
import { findMatchingLocale } from "@/lib/utils/locale";
import { createBrevoCustomer } from "@/modules/auth/lib/brevo";
import { createUser, getUserByEmail, updateUser } from "@/modules/auth/lib/user";
import {
  getAccessControlPermission,
  getIsMultiOrgEnabled,
  getIsSamlSsoEnabled,
  getIsSsoEnabled,
} from "@/modules/ee/license-check/lib/utils";
import { startSsoRecovery } from "@/modules/ee/sso/lib/sso-recovery";
import { createDefaultTeamMembership, getOrganizationByTeamId } from "@/modules/ee/sso/lib/team";
import { handleSsoCallback } from "../sso-handlers";
import {
  mockAccount,
  mockCreatedUser,
  mockOpenIdUser,
  mockOrganization,
  mockSamlAccount,
  mockUser,
} from "./__mock__/sso-handlers.mock";

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
    $transaction: vi.fn(
      async (callback: (tx: any) => unknown) =>
        await callback({
          account: {
            create: vi.fn(),
            delete: vi.fn(),
            findUnique: vi.fn(),
            update: vi.fn(),
          },
          user: {
            update: vi.fn(),
          },
        })
    ),
    account: {
      create: vi.fn(),
      delete: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    user: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
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

vi.mock("@/lib/membership/service", () => ({
  createMembership: vi.fn(),
}));

vi.mock("@/lib/utils/locale", () => ({
  findMatchingLocale: vi.fn(),
}));

vi.mock("@/lib/jwt", () => ({
  verifyInviteToken: vi.fn(),
}));

vi.mock("@/modules/ee/sso/lib/sso-recovery", () => ({
  startSsoRecovery: vi.fn(),
}));

vi.mock("@formbricks/logger", () => ({
  logger: {
    error: vi.fn(),
    debug: vi.fn(),
    withContext: vi.fn(() => ({
      debug: vi.fn(),
      error: vi.fn(),
      info: vi.fn(),
    })),
  },
}));

vi.mock("@/lib/constants", () => ({
  SKIP_INVITE_FOR_SSO: 0,
  DEFAULT_TEAM_ID: "team-123",
}));

vi.mock("@/lib/posthog", () => ({
  capturePostHogEvent: vi.fn(),
}));

const transactionAccount = {
  create: vi.fn(),
  delete: vi.fn(),
  findUnique: vi.fn(),
  update: vi.fn(),
};

const transactionUser = {
  update: vi.fn(),
};

describe("handleSsoCallback", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(prisma.$transaction).mockImplementation(
      async (callback: (tx: any) => unknown) =>
        await callback({
          account: transactionAccount,
          user: transactionUser,
        })
    );

    vi.mocked(getIsSsoEnabled).mockResolvedValue(true);
    vi.mocked(getIsSamlSsoEnabled).mockResolvedValue(true);
    vi.mocked(findMatchingLocale).mockResolvedValue("en-US");
    vi.mocked(getIsMultiOrgEnabled).mockResolvedValue(true);
    vi.mocked(getIsFreshInstance).mockResolvedValue(true);
    vi.mocked(getUserByEmail).mockResolvedValue(null);
    vi.mocked(updateUser).mockResolvedValue({ ...mockUser, id: "user-123" });
    vi.mocked(createDefaultTeamMembership).mockResolvedValue(undefined);
    vi.mocked(createMembership).mockResolvedValue({
      role: "member",
      accepted: true,
      userId: mockUser.id,
      organizationId: mockOrganization.id,
    });
    vi.mocked(getOrganizationByTeamId).mockResolvedValue(mockOrganization as unknown as Organization);
    vi.mocked(getAccessControlPermission).mockResolvedValue(true);
    vi.mocked(startSsoRecovery).mockResolvedValue("/auth/verification-requested?token=email-token");
    transactionAccount.findUnique.mockResolvedValue(null);
    transactionAccount.create.mockResolvedValue(undefined);
    transactionAccount.update.mockResolvedValue(undefined);
    transactionAccount.delete.mockResolvedValue(undefined);
    transactionUser.update.mockResolvedValue(undefined);
  });

  test("returns false when SSO is disabled", async () => {
    vi.mocked(getIsSsoEnabled).mockResolvedValue(false);

    const result = await handleSsoCallback({
      user: mockUser,
      account: mockAccount,
      callbackUrl: "http://localhost:3000",
    });

    expect(result).toBe(false);
  });

  test("syncs an existing canonical account link when the provider account already exists", async () => {
    vi.mocked(prisma.account.findUnique)
      .mockResolvedValueOnce({
        id: "account_1",
        provider: "google",
        user: {
          ...mockUser,
          email: mockUser.email,
        },
      } as any)
      .mockResolvedValueOnce(null);
    transactionAccount.findUnique.mockResolvedValue({
      id: "account_1",
      userId: mockUser.id,
    } as any);

    const result = await handleSsoCallback({
      user: mockUser,
      account: mockAccount,
      callbackUrl: "http://localhost:3000",
    });

    expect(result).toBe(true);
    expect(transactionAccount.update).toHaveBeenCalledWith({
      where: {
        id: "account_1",
      },
      data: {},
    });
    expect(transactionUser.update).toHaveBeenCalledWith({
      where: {
        id: mockUser.id,
      },
      data: {
        identityProvider: "google",
        identityProviderAccountId: mockAccount.providerAccountId,
      },
    });
  });

  test("normalizes legacy Azure account aliases into the canonical provider id", async () => {
    const azureAccount = { ...mockAccount, provider: "azuread" };

    vi.mocked(prisma.account.findUnique)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: "legacy_account_1",
        provider: "azure-ad",
        user: {
          ...mockUser,
          email: mockUser.email,
        },
      } as any)
      .mockResolvedValueOnce(null);
    transactionAccount.findUnique.mockResolvedValue(null);

    const result = await handleSsoCallback({
      user: mockUser,
      account: azureAccount,
      callbackUrl: "http://localhost:3000",
    });

    expect(result).toBe(true);
    expect(transactionAccount.update).toHaveBeenCalledWith({
      where: {
        id: "legacy_account_1",
      },
      data: {
        userId: mockUser.id,
        type: "oauth",
        provider: "azuread",
        providerAccountId: mockAccount.providerAccountId,
      },
    });
  });

  test("backfills a canonical account row from a legacy exact user match", async () => {
    vi.mocked(prisma.account.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.user.findFirst).mockResolvedValue({
      ...mockUser,
      identityProvider: "google",
      identityProviderAccountId: mockAccount.providerAccountId,
    } as any);
    transactionAccount.findUnique.mockResolvedValue(null);

    const result = await handleSsoCallback({
      user: mockUser,
      account: mockAccount,
      callbackUrl: "http://localhost:3000",
    });

    expect(result).toBe(true);
    expect(transactionAccount.create).toHaveBeenCalledWith({
      data: {
        userId: mockUser.id,
        type: "oauth",
        provider: "google",
        providerAccountId: mockAccount.providerAccountId,
      },
    });
    expect(transactionUser.update).toHaveBeenCalledWith({
      where: {
        id: mockUser.id,
      },
      data: {
        identityProvider: "google",
        identityProviderAccountId: mockAccount.providerAccountId,
      },
    });
  });

  test("starts inbox-based recovery for an existing same-email user without a linked account", async () => {
    vi.mocked(prisma.account.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.user.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      ...mockUser,
      identityProvider: "email",
      identityProviderAccountId: null,
      emailVerified: new Date(),
    } as any);

    const result = await handleSsoCallback({
      user: mockUser,
      account: mockAccount,
      callbackUrl: "http://localhost:3000/invite?token=invite-token",
    });

    expect(result).toBe("/auth/verification-requested?token=email-token");
    expect(startSsoRecovery).toHaveBeenCalledWith({
      existingUser: expect.objectContaining({
        id: mockUser.id,
        email: mockUser.email,
      }),
      provider: "google",
      account: mockAccount,
      callbackUrl: "http://localhost:3000/invite?token=invite-token",
    });
    expect(createUser).not.toHaveBeenCalled();
    expect(createMembership).not.toHaveBeenCalled();
    expect(createBrevoCustomer).not.toHaveBeenCalled();
    expect(capturePostHogEvent).not.toHaveBeenCalled();
  });

  test("keeps unverified email-password users in the recovery flow instead of activating them during SSO", async () => {
    vi.mocked(prisma.account.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.user.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      ...mockUser,
      identityProvider: "email",
      identityProviderAccountId: null,
      emailVerified: null,
    } as any);

    const result = await handleSsoCallback({
      user: mockUser,
      account: mockAccount,
      callbackUrl: "http://localhost:3000/invite?token=invite-token",
    });

    expect(result).toBe("/auth/verification-requested?token=email-token");
    expect(startSsoRecovery).toHaveBeenCalledWith({
      existingUser: expect.objectContaining({
        id: mockUser.id,
        email: mockUser.email,
        emailVerified: null,
        identityProvider: "email",
      }),
      provider: "google",
      account: mockAccount,
      callbackUrl: "http://localhost:3000/invite?token=invite-token",
    });
    expect(createUser).not.toHaveBeenCalled();
  });

  test("creates a new SSO user with canonical provider state when no existing user is found", async () => {
    vi.mocked(prisma.account.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.user.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
    vi.mocked(createUser).mockResolvedValue(mockCreatedUser());
    transactionAccount.findUnique.mockResolvedValue(null);

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
        identityProvider: "google",
        identityProviderAccountId: mockAccount.providerAccountId,
        locale: "en-US",
      },
      expect.anything()
    );
    expect(createBrevoCustomer).toHaveBeenCalledWith({ id: mockUser.id, email: mockUser.email });
    expect(capturePostHogEvent).toHaveBeenCalledWith(mockUser.id, "user_signed_up", {
      auth_provider: "google",
      email_domain: "example.com",
      signup_source: "direct",
      invite_organization_id: null,
    });
  });

  test("extracts fallback OpenID names when direct name is missing", async () => {
    vi.mocked(prisma.account.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.user.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
    vi.mocked(createUser).mockResolvedValue(mockCreatedUser("John Doe"));
    transactionAccount.findUnique.mockResolvedValue(null);

    const openIdUser = mockOpenIdUser({
      given_name: "John",
      family_name: "Doe",
    });

    await handleSsoCallback({
      user: openIdUser,
      account: { ...mockAccount, provider: "openid" },
      callbackUrl: "http://localhost:3000",
    });

    expect(createUser).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "John Doe",
        identityProvider: "openid",
      }),
      expect.anything()
    );
  });

  test("rejects SAML sign-in when the license is disabled", async () => {
    vi.mocked(getIsSamlSsoEnabled).mockResolvedValue(false);

    const result = await handleSsoCallback({
      user: mockUser,
      account: mockSamlAccount,
      callbackUrl: "http://localhost:3000",
    });

    expect(result).toBe(false);
  });
});
