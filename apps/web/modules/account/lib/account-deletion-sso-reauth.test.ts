import jwt from "jsonwebtoken";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { AuthorizationError, InvalidInputError } from "@formbricks/types/errors";
import { cache } from "@/lib/cache";
import { createAccountDeletionSsoReauthIntent, verifyAccountDeletionSsoReauthIntent } from "@/lib/jwt";
import { getUserAuthenticationData } from "@/lib/user/password";
import {
  ACCOUNT_DELETION_GOOGLE_REAUTH_NOT_CONFIGURED_ERROR_CODE,
  ACCOUNT_DELETION_SSO_REAUTH_REQUIRED_ERROR_CODE,
} from "@/modules/account/constants";
import {
  completeAccountDeletionSsoReauthentication,
  consumeAccountDeletionSsoReauthentication,
  startAccountDeletionSsoReauthentication,
  validateAccountDeletionSsoReauthenticationCallback,
} from "./account-deletion-sso-reauth";

vi.mock("server-only", () => ({}));

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
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock("@/lib/cache", () => ({
  cache: {
    get: vi.fn(),
    getRedisClient: vi.fn(),
    set: vi.fn(),
  },
}));

vi.mock("@/lib/constants", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/constants")>();
  return {
    ...actual,
    GOOGLE_ACCOUNT_DELETION_REAUTH_ENABLED: true,
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

const samlIntent = {
  ...intent,
  provider: "saml",
  providerAccountId: "saml-account-id",
};

const storedSamlIntent = {
  id: samlIntent.id,
  provider: samlIntent.provider,
  providerAccountId: samlIntent.providerAccountId,
  userId: samlIntent.userId,
};

const createIdToken = (authTime: number) => jwt.sign({ auth_time: authTime }, "test-secret");
const createAuthnInstant = (authTime: number) => new Date(authTime * 1000).toISOString();
const createRedisConsumeMock = (value: unknown) => {
  const redisEval = vi.fn().mockResolvedValue(value === null ? null : JSON.stringify(value));
  mockCache.getRedisClient.mockResolvedValueOnce({ eval: redisEval } as any);
  return redisEval;
};

describe("account deletion SSO reauthentication", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(crypto, "randomUUID").mockReturnValue("intent-id" as ReturnType<typeof crypto.randomUUID>);

    mockCache.get.mockResolvedValue({ ok: true, data: storedIntent });
    mockCache.getRedisClient.mockResolvedValue(null);
    mockCache.set.mockResolvedValue({ ok: true, data: undefined });
    mockPrismaAccountFindUnique.mockResolvedValue({ userId: intent.userId } as any);
    mockPrismaUserFindFirst.mockResolvedValue(null);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test("starts Google reauthentication with a signed, cached intent and verifiable freshness params", async () => {
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
        claims: JSON.stringify({
          id_token: {
            auth_time: {
              essential: true,
            },
          },
        }),
        login_hint: intent.email,
        max_age: "0",
      },
      callbackUrl: "http://localhost:3000/auth/account-deletion/sso/complete?intent=intent-token",
      provider: "google",
    });
  });

  test("does not start SSO reauthentication for providers without verifiable freshness", async () => {
    mockGetUserAuthenticationData.mockResolvedValue({
      email: intent.email,
      identityProvider: "github",
      identityProviderAccountId: "github-account-id",
      password: null,
    } as any);

    await expect(
      startAccountDeletionSsoReauthentication({
        confirmationEmail: intent.email,
        returnToUrl: "/environments/env-1/settings/profile",
        userId: intent.userId,
      })
    ).rejects.toThrow(ACCOUNT_DELETION_SSO_REAUTH_REQUIRED_ERROR_CODE);

    expect(mockCache.set).not.toHaveBeenCalled();
    expect(mockCreateAccountDeletionSsoReauthIntent).not.toHaveBeenCalled();
  });

  test("does not start SSO reauthentication for password-backed users", async () => {
    mockGetUserAuthenticationData.mockResolvedValue({
      email: intent.email,
      identityProvider: "email",
      identityProviderAccountId: null,
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

  test("validates a fresh OIDC callback before the normal SSO handler runs", async () => {
    const nowInSeconds = Math.floor(Date.now() / 1000);
    mockVerifyAccountDeletionSsoReauthIntent.mockReturnValue(intent);

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
    expect(mockCache.getRedisClient).not.toHaveBeenCalled();
  });

  test("rejects Google callbacks without an auth_time claim", async () => {
    mockVerifyAccountDeletionSsoReauthIntent.mockReturnValue(intent);

    await expect(
      validateAccountDeletionSsoReauthenticationCallback({
        account: {
          id_token: jwt.sign({}, "test-secret"),
          provider: "google",
          providerAccountId: intent.providerAccountId,
          type: "oauth",
        } as any,
        intentToken: "intent-token",
      })
    ).rejects.toThrow(ACCOUNT_DELETION_GOOGLE_REAUTH_NOT_CONFIGURED_ERROR_CODE);

    expect(mockCache.get).not.toHaveBeenCalled();
  });

  test("validates a fresh SAML callback with an AuthnInstant", async () => {
    const nowInSeconds = Math.floor(Date.now() / 1000);
    mockVerifyAccountDeletionSsoReauthIntent.mockReturnValue(samlIntent);
    mockCache.get.mockResolvedValue({ ok: true, data: storedSamlIntent });

    await expect(
      validateAccountDeletionSsoReauthenticationCallback({
        account: {
          authn_instant: createAuthnInstant(nowInSeconds),
          provider: "saml",
          providerAccountId: samlIntent.providerAccountId,
          type: "oauth",
        } as any,
        intentToken: "intent-token",
      })
    ).resolves.toBeUndefined();

    expect(mockCache.get).toHaveBeenCalled();
    expect(mockCache.getRedisClient).not.toHaveBeenCalled();
  });

  test("rejects stale SAML AuthnInstant values without consuming the intent", async () => {
    const nowInSeconds = Math.floor(Date.now() / 1000);
    mockVerifyAccountDeletionSsoReauthIntent.mockReturnValue(samlIntent);

    await expect(
      completeAccountDeletionSsoReauthentication({
        account: {
          authn_instant: createAuthnInstant(nowInSeconds - 10 * 60),
          provider: "saml",
          providerAccountId: samlIntent.providerAccountId,
          type: "oauth",
        } as any,
        intentToken: "intent-token",
      })
    ).rejects.toThrow(AuthorizationError);

    expect(mockCache.getRedisClient).not.toHaveBeenCalled();
    expect(mockPrismaAccountFindUnique).not.toHaveBeenCalled();
  });

  test("stores a deletion marker after fresh SSO reauthentication and linked-user checks", async () => {
    const nowInSeconds = Math.floor(Date.now() / 1000);
    const redisEval = createRedisConsumeMock(storedIntent);
    mockVerifyAccountDeletionSsoReauthIntent.mockReturnValue(intent);

    await completeAccountDeletionSsoReauthentication({
      account: {
        id_token: createIdToken(nowInSeconds),
        provider: "google",
        providerAccountId: intent.providerAccountId,
        type: "oauth",
      } as any,
      intentToken: "intent-token",
    });

    expect(mockPrismaAccountFindUnique.mock.invocationCallOrder[0]).toBeLessThan(
      redisEval.mock.invocationCallOrder[0]
    );
    expect(mockCache.set).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining(storedIntent),
      5 * 60 * 1000
    );
  });

  test("consumes a matching SSO reauthentication marker atomically before account deletion", async () => {
    createRedisConsumeMock({
      ...storedIntent,
      completedAt: Date.now(),
    });

    await expect(
      consumeAccountDeletionSsoReauthentication({
        identityProvider: "google",
        providerAccountId: intent.providerAccountId,
        userId: intent.userId,
      })
    ).resolves.toBeUndefined();

    expect(mockCache.getRedisClient).toHaveBeenCalled();
  });
});
