import jwt from "jsonwebtoken";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { AuthorizationError, InvalidInputError } from "@formbricks/types/errors";
import { cache } from "@/lib/cache";
import { createAccountDeletionSsoReauthIntent, verifyAccountDeletionSsoReauthIntent } from "@/lib/jwt";
import { getUserAuthenticationData } from "@/lib/user/password";
import {
  completeAccountDeletionSsoReauthentication,
  consumeAccountDeletionSsoReauthentication,
  startAccountDeletionSsoReauthentication,
  validateAccountDeletionSsoReauthenticationCallback,
} from "./account-deletion-sso-reauth";

vi.mock("@formbricks/database", () => ({
  prisma: {
    account: {
      findUnique: vi.fn(),
    },
    user: {
      findFirst: vi.fn(),
    },
  },
}));

vi.mock("@formbricks/logger", () => ({
  logger: {
    error: vi.fn(),
  },
}));

vi.mock("@/lib/cache", () => ({
  cache: {
    del: vi.fn(),
    get: vi.fn(),
    getRedisClient: vi.fn(),
    set: vi.fn(),
  },
}));

vi.mock("@/lib/constants", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/constants")>();
  return {
    ...actual,
    SAML_PRODUCT: "formbricks",
    SAML_TENANT: "formbricks.com",
    WEBAPP_URL: "http://localhost:3000",
  };
});

vi.mock("@/lib/jwt", () => ({
  createAccountDeletionSsoReauthIntent: vi.fn(),
  verifyAccountDeletionSsoReauthIntent: vi.fn(),
}));

vi.mock("@/lib/user/password", () => ({
  getUserAuthenticationData: vi.fn(),
}));

const mockCache = vi.mocked(cache);
const mockPrismaAccountFindUnique = vi.mocked(prisma.account.findUnique);
const mockPrismaUserFindFirst = vi.mocked(prisma.user.findFirst);
const mockCreateAccountDeletionSsoReauthIntent = vi.mocked(createAccountDeletionSsoReauthIntent);
const mockVerifyAccountDeletionSsoReauthIntent = vi.mocked(verifyAccountDeletionSsoReauthIntent);
const mockGetUserAuthenticationData = vi.mocked(getUserAuthenticationData);

const intent = {
  id: "intent-id",
  email: "sso-user@example.com",
  provider: "google",
  providerAccountId: "google-account-id",
  purpose: "account_deletion_sso_reauth" as const,
  returnToUrl: "http://localhost:3000/environments/env-1/settings/profile",
  userId: "user-id",
};

const storedIntent = {
  id: intent.id,
  provider: intent.provider,
  providerAccountId: intent.providerAccountId,
  userId: intent.userId,
};

const createIdToken = (authTime: number) => jwt.sign({ auth_time: authTime }, "test-secret");

describe("account deletion SSO reauthentication", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(crypto, "randomUUID").mockReturnValue("intent-id" as ReturnType<typeof crypto.randomUUID>);

    mockCache.getRedisClient.mockResolvedValue(null);
    mockCache.set.mockResolvedValue({ ok: true, data: undefined });
    mockCache.del.mockResolvedValue({ ok: true, data: undefined });
    mockPrismaUserFindFirst.mockResolvedValue(null);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test("starts SSO reauthentication with a signed, cached intent", async () => {
    mockGetUserAuthenticationData.mockResolvedValue({
      email: intent.email,
      identityProvider: "google",
      identityProviderAccountId: intent.providerAccountId,
      password: null,
    } as any);
    mockCreateAccountDeletionSsoReauthIntent.mockReturnValue("intent-token");

    const result = await startAccountDeletionSsoReauthentication({
      confirmationEmail: "SSO-USER@example.com",
      returnToUrl: "/environments/env-1/settings/profile",
      userId: intent.userId,
    });

    expect(mockCache.set).toHaveBeenCalledWith(expect.any(String), storedIntent, 10 * 60 * 1000);
    expect(mockCreateAccountDeletionSsoReauthIntent).toHaveBeenCalledWith({
      ...intent,
      returnToUrl: "http://localhost:3000/environments/env-1/settings/profile",
    });
    expect(result).toEqual({
      authorizationParams: {
        login_hint: intent.email,
        max_age: "0",
        prompt: "login",
      },
      callbackUrl: "http://localhost:3000/auth/account-deletion/sso/complete?intent=intent-token",
      provider: "google",
    });
  });

  test("does not start SSO reauthentication for password-backed users", async () => {
    mockGetUserAuthenticationData.mockResolvedValue({
      email: intent.email,
      identityProvider: "google",
      identityProviderAccountId: intent.providerAccountId,
      password: "hashed-password",
    } as any);

    await expect(
      startAccountDeletionSsoReauthentication({
        confirmationEmail: intent.email,
        returnToUrl: "/environments/env-1/settings/profile",
        userId: intent.userId,
      })
    ).rejects.toThrow(InvalidInputError);

    expect(mockCache.set).not.toHaveBeenCalled();
  });

  test("fails SSO completion when the callback provider does not match the intent", async () => {
    mockVerifyAccountDeletionSsoReauthIntent.mockReturnValue(intent);
    mockCache.get.mockResolvedValue({ ok: true, data: storedIntent });

    await expect(
      completeAccountDeletionSsoReauthentication({
        account: {
          provider: "github",
          providerAccountId: intent.providerAccountId,
          type: "oauth",
        } as any,
        intentToken: "intent-token",
      })
    ).rejects.toThrow(AuthorizationError);

    expect(mockCache.del).toHaveBeenCalled();
  });

  test("rejects a mismatched SSO callback before reading or consuming the intent", async () => {
    mockVerifyAccountDeletionSsoReauthIntent.mockReturnValue(intent);

    await expect(
      validateAccountDeletionSsoReauthenticationCallback({
        account: {
          provider: "github",
          providerAccountId: intent.providerAccountId,
          type: "oauth",
        } as any,
        intentToken: "intent-token",
      })
    ).rejects.toThrow(AuthorizationError);

    expect(mockCache.get).not.toHaveBeenCalled();
    expect(mockCache.del).not.toHaveBeenCalled();
  });

  test("validates a fresh SSO callback before the normal SSO handler runs", async () => {
    const nowInSeconds = Math.floor(Date.now() / 1000);
    mockVerifyAccountDeletionSsoReauthIntent.mockReturnValue(intent);
    mockCache.get.mockResolvedValue({ ok: true, data: storedIntent });

    await expect(
      validateAccountDeletionSsoReauthenticationCallback({
        account: {
          id_token: createIdToken(nowInSeconds),
          provider: "google",
          providerAccountId: intent.providerAccountId,
          type: "oauth",
        } as any,
        intentToken: "intent-token",
      })
    ).resolves.toBeUndefined();

    expect(mockCache.get).toHaveBeenCalled();
    expect(mockCache.del).not.toHaveBeenCalled();
  });

  test("rejects stale OIDC auth_time claims", async () => {
    const nowInSeconds = Math.floor(Date.now() / 1000);
    mockVerifyAccountDeletionSsoReauthIntent.mockReturnValue(intent);
    mockCache.get.mockResolvedValue({ ok: true, data: storedIntent });

    await expect(
      completeAccountDeletionSsoReauthentication({
        account: {
          id_token: createIdToken(nowInSeconds - 10 * 60),
          provider: "google",
          providerAccountId: intent.providerAccountId,
          type: "oauth",
        } as any,
        intentToken: "intent-token",
      })
    ).rejects.toThrow(AuthorizationError);

    expect(mockPrismaAccountFindUnique).not.toHaveBeenCalled();
  });

  test("stores a deletion marker after fresh SSO reauthentication", async () => {
    const nowInSeconds = Math.floor(Date.now() / 1000);
    mockVerifyAccountDeletionSsoReauthIntent.mockReturnValue(intent);
    mockCache.get.mockResolvedValue({ ok: true, data: storedIntent });
    mockPrismaAccountFindUnique.mockResolvedValue({ userId: intent.userId } as any);

    await completeAccountDeletionSsoReauthentication({
      account: {
        id_token: createIdToken(nowInSeconds),
        provider: "google",
        providerAccountId: intent.providerAccountId,
        type: "oauth",
      } as any,
      intentToken: "intent-token",
    });

    expect(mockCache.set).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining(storedIntent),
      5 * 60 * 1000
    );
  });

  test("fails SSO completion when the provider account belongs to another user", async () => {
    const nowInSeconds = Math.floor(Date.now() / 1000);
    mockVerifyAccountDeletionSsoReauthIntent.mockReturnValue(intent);
    mockCache.get.mockResolvedValue({ ok: true, data: storedIntent });
    mockPrismaAccountFindUnique.mockResolvedValue({ userId: "other-user-id" } as any);

    await expect(
      completeAccountDeletionSsoReauthentication({
        account: {
          id_token: createIdToken(nowInSeconds),
          provider: "google",
          providerAccountId: intent.providerAccountId,
          type: "oauth",
        } as any,
        intentToken: "intent-token",
      })
    ).rejects.toThrow(AuthorizationError);
  });

  test("requires a completed SSO reauthentication marker before deleting an SSO account", async () => {
    mockCache.get.mockResolvedValue({ ok: true, data: null });

    await expect(
      consumeAccountDeletionSsoReauthentication({
        identityProvider: "google",
        providerAccountId: intent.providerAccountId,
        userId: intent.userId,
      })
    ).rejects.toThrow(AuthorizationError);
  });

  test("consumes a valid SSO reauthentication marker", async () => {
    mockCache.get.mockResolvedValue({
      ok: true,
      data: {
        ...storedIntent,
        completedAt: Date.now(),
      },
    });

    await expect(
      consumeAccountDeletionSsoReauthentication({
        identityProvider: "google",
        providerAccountId: intent.providerAccountId,
        userId: intent.userId,
      })
    ).resolves.toBeUndefined();

    expect(mockCache.del).toHaveBeenCalled();
  });

  test("rejects an expired SSO reauthentication marker", async () => {
    mockCache.get.mockResolvedValue({
      ok: true,
      data: {
        ...storedIntent,
        completedAt: Date.now() - 6 * 60 * 1000,
      },
    });

    await expect(
      consumeAccountDeletionSsoReauthentication({
        identityProvider: "google",
        providerAccountId: intent.providerAccountId,
        userId: intent.userId,
      })
    ).rejects.toThrow(AuthorizationError);

    expect(mockCache.del).toHaveBeenCalled();
  });
});
