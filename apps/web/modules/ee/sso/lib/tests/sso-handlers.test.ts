import { Organization } from "@prisma/client";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { getIsFreshInstance } from "@/lib/instance/service";
import { verifyInviteToken } from "@/lib/jwt";
import { createMembership } from "@/lib/membership/service";
import { capturePostHogEvent } from "@/lib/posthog";
import { findMatchingLocale } from "@/lib/utils/locale";
import { createBrevoCustomer } from "@/modules/auth/lib/brevo";
import { createUser, getUserByEmail, updateUser } from "@/modules/auth/lib/user";
import { getIsValidInviteToken } from "@/modules/auth/signup/lib/invite";
import {
  getAccessControlPermission,
  getIsMultiOrgEnabled,
  getIsSamlSsoEnabled,
  getIsSsoEnabled,
} from "@/modules/ee/license-check/lib/utils";
import { getFirstOrganization } from "@/modules/ee/sso/lib/organization";
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

vi.mock("@/modules/ee/sso/lib/organization", () => ({
  getFirstOrganization: vi.fn(),
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

vi.mock("@/lib/constants", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/constants")>();
  return {
    ...actual,
    SKIP_INVITE_FOR_SSO: 0,
    DEFAULT_TEAM_ID: "team-123",
  };
});

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
    vi.mocked(getFirstOrganization).mockResolvedValue(mockOrganization as unknown as Organization);
    vi.mocked(getOrganizationByTeamId).mockResolvedValue(mockOrganization as unknown as Organization);
    vi.mocked(getAccessControlPermission).mockResolvedValue(true);
    vi.mocked(startSsoRecovery).mockResolvedValue("/auth/verification-requested?token=email-token");
    vi.mocked(getIsValidInviteToken).mockResolvedValue(true);
    vi.mocked(verifyInviteToken).mockReturnValue({
      email: mockUser.email,
      inviteId: "invite-123",
    } as any);
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

  test("updates the linked SSO user email when the provider email changes without conflicts", async () => {
    vi.mocked(prisma.account.findUnique).mockResolvedValueOnce({
      id: "account_1",
      provider: "google",
      user: {
        ...mockUser,
        id: "linked-user-1",
        email: "old@example.com",
      },
    } as any);
    transactionAccount.findUnique.mockResolvedValue({
      id: "account_1",
      userId: "linked-user-1",
    } as any);

    const result = await handleSsoCallback({
      user: {
        ...mockUser,
        email: "new@example.com",
      },
      account: mockAccount,
      callbackUrl: "http://localhost:3000",
    });

    expect(result).toBe(true);
    expect(transactionUser.update).toHaveBeenNthCalledWith(1, {
      where: {
        id: "linked-user-1",
      },
      data: {
        email: "new@example.com",
      },
    });
    expect(transactionUser.update).toHaveBeenNthCalledWith(2, {
      where: {
        id: "linked-user-1",
      },
      data: {
        identityProvider: "google",
        identityProviderAccountId: mockAccount.providerAccountId,
      },
    });
  });

  test("rejects sign-in when the provider email changes to an email that is already taken", async () => {
    vi.mocked(prisma.account.findUnique).mockResolvedValueOnce({
      id: "account_1",
      provider: "google",
      user: {
        ...mockUser,
        id: "linked-user-1",
        email: "old@example.com",
      },
    } as any);
    vi.mocked(getUserByEmail).mockResolvedValueOnce({
      ...mockUser,
      id: "conflict-user-1",
      email: "new@example.com",
    } as any);

    await expect(
      handleSsoCallback({
        user: {
          ...mockUser,
          email: "new@example.com",
        },
        account: mockAccount,
        callbackUrl: "http://localhost:3000",
      })
    ).rejects.toThrow("Looks like you updated your email somewhere else.");

    expect(transactionUser.update).not.toHaveBeenCalled();
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

  test("starts recovery for a legacy SSO-only user when the stored provider account id is stale", async () => {
    vi.mocked(prisma.account.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.user.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      ...mockUser,
      identityProvider: "google",
      identityProviderAccountId: "legacy-google-subject",
      emailVerified: new Date(),
      password: null,
    } as any);

    const result = await handleSsoCallback({
      user: mockUser,
      account: {
        ...mockAccount,
        provider: "google",
        providerAccountId: "new-google-subject",
      },
      callbackUrl: "http://localhost:3000",
    });

    expect(result).toBe("/auth/verification-requested?token=email-token");
    expect(startSsoRecovery).toHaveBeenCalledWith({
      existingUser: expect.objectContaining({
        id: mockUser.id,
        email: mockUser.email,
        identityProvider: "google",
        identityProviderAccountId: "legacy-google-subject",
      }),
      provider: "google",
      account: expect.objectContaining({
        provider: "google",
        providerAccountId: "new-google-subject",
      }),
      callbackUrl: "http://localhost:3000",
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

  test("extracts the preferred OpenID username when no other name fields are present", async () => {
    vi.mocked(prisma.account.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.user.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
    vi.mocked(createUser).mockResolvedValue(mockCreatedUser("oidc-handle"));
    transactionAccount.findUnique.mockResolvedValue(null);

    await handleSsoCallback({
      user: mockOpenIdUser({
        preferred_username: "oidc-handle",
      }),
      account: { ...mockAccount, provider: "openid" },
      callbackUrl: "http://localhost:3000",
    });

    expect(createUser).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "oidc-handle",
        identityProvider: "openid",
      }),
      expect.anything()
    );
  });

  test("extracts fallback SAML names when the display name is missing", async () => {
    vi.mocked(prisma.account.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.user.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
    vi.mocked(createUser).mockResolvedValue(mockCreatedUser("Saml User"));
    transactionAccount.findUnique.mockResolvedValue(null);

    await handleSsoCallback({
      user: {
        ...mockUser,
        name: "",
        firstName: "Saml",
        lastName: "User",
      } as any,
      account: mockSamlAccount,
      callbackUrl: "http://localhost:3000",
    });

    expect(createUser).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Saml User",
        identityProvider: "saml",
      }),
      expect.anything()
    );
  });

  test("rejects new SSO sign-up when invite validation requires a callback URL and none is provided", async () => {
    vi.mocked(prisma.account.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.user.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
    vi.mocked(getIsFreshInstance).mockResolvedValue(false);
    vi.mocked(getIsMultiOrgEnabled).mockResolvedValue(false);

    const result = await handleSsoCallback({
      user: mockUser,
      account: mockAccount,
      callbackUrl: "",
    });

    expect(result).toBe(false);
    expect(createUser).not.toHaveBeenCalled();
  });

  test("rejects sign-in callback URLs that claim a signin source without an invite token", async () => {
    vi.mocked(prisma.account.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.user.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
    vi.mocked(getIsFreshInstance).mockResolvedValue(false);
    vi.mocked(getIsMultiOrgEnabled).mockResolvedValue(false);

    const result = await handleSsoCallback({
      user: mockUser,
      account: mockAccount,
      callbackUrl: "http://localhost:3000/auth/login?source=signin",
    });

    expect(result).toBe(false);
    expect(createUser).not.toHaveBeenCalled();
  });

  test("rejects invite tokens that belong to a different email address", async () => {
    vi.mocked(prisma.account.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.user.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
    vi.mocked(getIsFreshInstance).mockResolvedValue(false);
    vi.mocked(getIsMultiOrgEnabled).mockResolvedValue(false);
    vi.mocked(verifyInviteToken).mockReturnValue({
      email: "someone-else@example.com",
      inviteId: "invite-123",
    } as any);

    const result = await handleSsoCallback({
      user: mockUser,
      account: mockAccount,
      callbackUrl: "http://localhost:3000/invite?token=invite-token",
    });

    expect(result).toBe(false);
    expect(getIsValidInviteToken).not.toHaveBeenCalled();
  });

  test("rejects invalid or expired invite tokens during new SSO sign-up", async () => {
    vi.mocked(prisma.account.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.user.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
    vi.mocked(getIsFreshInstance).mockResolvedValue(false);
    vi.mocked(getIsMultiOrgEnabled).mockResolvedValue(false);
    vi.mocked(getIsValidInviteToken).mockResolvedValue(false);

    const result = await handleSsoCallback({
      user: mockUser,
      account: mockAccount,
      callbackUrl: "http://localhost:3000/invite?token=invite-token",
    });

    expect(result).toBe(false);
    expect(createUser).not.toHaveBeenCalled();
  });

  test("rejects malformed callback URLs during invite validation", async () => {
    vi.mocked(prisma.account.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.user.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
    vi.mocked(getIsFreshInstance).mockResolvedValue(false);
    vi.mocked(getIsMultiOrgEnabled).mockResolvedValue(false);

    const result = await handleSsoCallback({
      user: mockUser,
      account: mockAccount,
      callbackUrl: "not-a-valid-url",
    });

    expect(result).toBe(false);
    expect(createUser).not.toHaveBeenCalled();
  });

  test("rejects new SSO sign-up when no organization can be assigned", async () => {
    vi.mocked(prisma.account.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.user.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
    vi.mocked(getIsFreshInstance).mockResolvedValue(false);
    vi.mocked(getIsMultiOrgEnabled).mockResolvedValue(false);
    vi.mocked(getFirstOrganization).mockResolvedValue(null);

    const result = await handleSsoCallback({
      user: mockUser,
      account: mockAccount,
      callbackUrl: "http://localhost:3000/invite?token=invite-token",
    });

    expect(result).toBe(false);
    expect(createUser).not.toHaveBeenCalled();
  });

  test("assigns invited SSO users into the resolved organization and syncs notification settings", async () => {
    vi.mocked(prisma.account.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.user.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
    vi.mocked(getIsFreshInstance).mockResolvedValue(false);
    vi.mocked(getIsMultiOrgEnabled).mockResolvedValue(false);
    vi.mocked(verifyInviteToken).mockReturnValue({
      email: "invited@example.com",
      inviteId: "invite-123",
    } as any);
    vi.mocked(createUser).mockResolvedValue(
      mockCreatedUser("Org User") as typeof mockUser & {
        notificationSettings: { alert: Record<string, never>; unsubscribedOrganizationIds: string[] };
      }
    );
    transactionAccount.findUnique.mockResolvedValue(null);

    const result = await handleSsoCallback({
      user: {
        ...mockUser,
        email: "invited@example.com",
      },
      account: mockAccount,
      callbackUrl: "http://localhost:3000/invite?token=invite-token",
    });

    expect(result).toBe(true);
    expect(createMembership).toHaveBeenCalledWith(
      mockOrganization.id,
      mockUser.id,
      { role: "member", accepted: true },
      expect.anything()
    );
    expect(updateUser).toHaveBeenCalledWith(
      mockUser.id,
      {
        notificationSettings: {
          alert: {},
          unsubscribedOrganizationIds: [mockOrganization.id],
        },
      },
      expect.anything()
    );
    expect(capturePostHogEvent).toHaveBeenCalledWith(mockUser.id, "user_signed_up", {
      auth_provider: "google",
      email_domain: "example.com",
      signup_source: "invite",
      invite_organization_id: mockOrganization.id,
    });
  });

  test("rejects unsupported providers before any database writes happen", async () => {
    const result = await handleSsoCallback({
      user: mockUser,
      account: {
        ...mockAccount,
        provider: "twitter",
      } as any,
      callbackUrl: "http://localhost:3000",
    });

    expect(result).toBe(false);
    expect(prisma.account.findUnique).not.toHaveBeenCalled();
    expect(createUser).not.toHaveBeenCalled();
  });

  test("rejects non-oauth accounts and users without an email address", async () => {
    await expect(
      handleSsoCallback({
        user: {
          ...mockUser,
          email: "",
        },
        account: mockAccount,
        callbackUrl: "http://localhost:3000",
      })
    ).resolves.toBe(false);

    await expect(
      handleSsoCallback({
        user: mockUser,
        account: {
          ...mockAccount,
          type: "email",
        } as any,
        callbackUrl: "http://localhost:3000",
      })
    ).resolves.toBe(false);
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
