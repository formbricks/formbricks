import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { finalizeSuccessfulSignIn } from "@/modules/auth/lib/sign-in-tracking";
import { buildVerificationRequestedPath } from "@/modules/auth/lib/verification-links";
import { sendVerificationEmail } from "@/modules/email";
import { syncSsoIdentityForUser } from "./account-linking";
import { completeSsoRecovery, startSsoRecovery } from "./sso-recovery";

const mocks = vi.hoisted(() => ({
  createEmailToken: vi.fn(),
  createSsoRelinkIntent: vi.fn(),
  verifySsoRelinkIntent: vi.fn(),
  queueAuditEventBackground: vi.fn(),
}));

vi.mock("@formbricks/database", () => ({
  prisma: {
    $transaction: vi.fn(),
    user: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("@/lib/constants", () => ({
  WEBAPP_URL: "http://localhost:3000",
}));

vi.mock("@/lib/jwt", () => ({
  createEmailToken: mocks.createEmailToken,
  createSsoRelinkIntent: mocks.createSsoRelinkIntent,
  verifySsoRelinkIntent: mocks.verifySsoRelinkIntent,
}));

vi.mock("@/modules/auth/lib/sign-in-tracking", () => ({
  finalizeSuccessfulSignIn: vi.fn(),
}));

vi.mock("@/modules/auth/lib/verification-links", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/modules/auth/lib/verification-links")>();
  return {
    ...actual,
    buildVerificationRequestedPath: vi.fn(),
  };
});

vi.mock("@/modules/email", () => ({
  sendVerificationEmail: vi.fn(),
}));

vi.mock("@/modules/ee/audit-logs/lib/handler", () => ({
  queueAuditEventBackground: mocks.queueAuditEventBackground,
}));

vi.mock("@formbricks/logger", () => ({
  logger: {
    error: vi.fn(),
    withContext: vi.fn(() => ({
      error: vi.fn(),
      info: vi.fn(),
    })),
  },
}));

vi.mock("./account-linking", () => ({
  LINKED_SSO_LOOKUP_SELECT: {
    id: true,
    email: true,
    locale: true,
    emailVerified: true,
    isActive: true,
    identityProvider: true,
    identityProviderAccountId: true,
  },
  syncSsoIdentityForUser: vi.fn(),
}));

describe("sso-recovery", () => {
  const txUserUpdate = vi.fn();
  const tx = {
    user: {
      update: txUserUpdate,
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.$transaction).mockImplementation(
      async (callback: (tx: typeof tx) => Promise<unknown>) => await callback(tx)
    );
    vi.mocked(buildVerificationRequestedPath).mockReturnValue(
      "/auth/verification-requested?token=email-token&purpose=sso_recovery"
    );
    mocks.createEmailToken.mockReturnValue("email-token");
    mocks.createSsoRelinkIntent.mockReturnValue("intent-token");
    mocks.verifySsoRelinkIntent.mockReturnValue({
      userId: "user_1",
      email: "john.doe@example.com",
      provider: "google",
      providerAccountId: "provider-account-1",
      callbackUrl: "http://localhost:3000/environments/env_1",
    });
  });

  test("preserves the recovery purpose when building the verification requested path", async () => {
    vi.mocked(sendVerificationEmail).mockResolvedValue(true);

    const result = await startSsoRecovery({
      existingUser: {
        id: "user_1",
        email: "john.doe@example.com",
        locale: "en-US",
        emailVerified: null,
        isActive: true,
        identityProvider: "email",
        identityProviderAccountId: null,
      },
      provider: "google",
      account: {
        type: "oauth",
        provider: "google",
        providerAccountId: "provider-account-1",
      } as any,
      callbackUrl: "http://localhost:3000/environments/env_1",
    });

    expect(sendVerificationEmail).toHaveBeenCalledWith({
      id: "user_1",
      email: "john.doe@example.com",
      locale: "en-US",
      callbackUrl: "http://localhost:3000/api/auth/sso/recovery/complete?intent=intent-token",
      purpose: "sso_recovery",
    });
    expect(buildVerificationRequestedPath).toHaveBeenCalledWith({
      token: "email-token",
      callbackUrl: "http://localhost:3000/api/auth/sso/recovery/complete?intent=intent-token",
      purpose: "sso_recovery",
    });
    expect(result).toBe("/auth/verification-requested?token=email-token&purpose=sso_recovery");
  });

  test("reclaims unverified local auth factors before linking SSO", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "user_1",
      email: "john.doe@example.com",
      locale: "en-US",
      emailVerified: null,
      isActive: true,
      identityProvider: "email",
      identityProviderAccountId: null,
      password: "hashed-password",
      twoFactorEnabled: true,
      twoFactorSecret: "encrypted-secret",
      backupCodes: "encrypted-codes",
    } as any);

    const callbackUrl = await completeSsoRecovery({
      intentToken: "test-intent",
      sessionUserId: "user_1",
    });

    expect(txUserUpdate).toHaveBeenCalledWith({
      where: {
        id: "user_1",
      },
      data: {
        backupCodes: null,
        emailVerified: expect.any(Date),
        password: null,
        twoFactorEnabled: false,
        twoFactorSecret: null,
      },
    });
    expect(syncSsoIdentityForUser).toHaveBeenCalledWith({
      userId: "user_1",
      provider: "google",
      account: {
        type: "oauth",
        provider: "google",
        providerAccountId: "provider-account-1",
      },
      tx,
    });
    expect(finalizeSuccessfulSignIn).toHaveBeenCalledWith({
      userId: "user_1",
      email: "john.doe@example.com",
      provider: "google",
    });
    expect(callbackUrl).toBe("http://localhost:3000/environments/env_1");
  });

  test("does not clear local auth material for already verified users", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "user_1",
      email: "john.doe@example.com",
      locale: "en-US",
      emailVerified: new Date("2024-01-01T00:00:00.000Z"),
      isActive: true,
      identityProvider: "email",
      identityProviderAccountId: null,
      password: "hashed-password",
      twoFactorEnabled: true,
      twoFactorSecret: "encrypted-secret",
      backupCodes: "encrypted-codes",
    } as any);

    await completeSsoRecovery({
      intentToken: "test-intent",
      sessionUserId: "user_1",
    });

    expect(txUserUpdate).not.toHaveBeenCalled();
    expect(syncSsoIdentityForUser).toHaveBeenCalledOnce();
  });
});
