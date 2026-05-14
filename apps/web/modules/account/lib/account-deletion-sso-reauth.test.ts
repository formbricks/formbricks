import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { ErrorCode } from "@formbricks/cache";
import { prisma } from "@formbricks/database";
import { AuthorizationError, InvalidInputError } from "@formbricks/types/errors";
import { cache } from "@/lib/cache";
import { createAccountDeletionSsoReauthIntent, verifyAccountDeletionSsoReauthIntent } from "@/lib/jwt";
import { getUserAuthenticationData } from "@/lib/user/password";
import {
  ACCOUNT_DELETION_SSO_REAUTH_ERROR_QUERY_PARAM,
  ACCOUNT_DELETION_SSO_REAUTH_FAILED_ERROR_CODE,
} from "@/modules/account/constants";
import {
  completeAccountDeletionSsoReauthentication,
  consumeAccountDeletionSsoReauthentication,
  getAccountDeletionSsoReauthFailureRedirectUrl,
  getAccountDeletionSsoReauthIntentFromCallbackUrl,
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
    info: vi.fn(),
    warn: vi.fn(),
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
const cacheError = { code: ErrorCode.Unknown };

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

const mockRedisConsume = (value: unknown) => {
  const redisEval = vi.fn().mockResolvedValue(value === null ? null : JSON.stringify(value));
  mockCache.getRedisClient.mockResolvedValueOnce({ eval: redisEval } as any);
  return redisEval;
};

describe("account deletion SSO identity confirmation", () => {
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

  test("starts SSO identity confirmation with a signed, cached intent", async () => {
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
        prompt: "login",
      },
      callbackUrl: "http://localhost:3000/auth/account-deletion/sso/complete?intent=intent-token",
      provider: "google",
    });
  });

  test("requests interactive login without freshness-only SSO authorization parameters", async () => {
    mockCreateAccountDeletionSsoReauthIntent.mockReturnValue("intent-token");

    for (const identityProvider of ["google", "azuread", "openid"] as const) {
      mockGetUserAuthenticationData.mockResolvedValueOnce({
        email: intent.email,
        identityProvider,
        identityProviderAccountId: `${identityProvider}-account-id`,
        password: null,
      } as any);

      const result = await startAccountDeletionSsoReauthentication({
        confirmationEmail: intent.email,
        returnToUrl: "/environments/env-1/settings/profile",
        userId: intent.userId,
      });

      expect(result.authorizationParams).toEqual({
        login_hint: intent.email,
        prompt: "login",
      });
      expect(result.authorizationParams).not.toHaveProperty("claims");
      expect(result.authorizationParams).not.toHaveProperty("max_age");
    }
  });

  test("starts GitHub SSO identity confirmation with account picker params", async () => {
    mockGetUserAuthenticationData.mockResolvedValue({
      email: intent.email,
      identityProvider: "github",
      identityProviderAccountId: "github-account-id",
      password: null,
    } as any);
    mockCreateAccountDeletionSsoReauthIntent.mockReturnValue("intent-token");

    const result = await startAccountDeletionSsoReauthentication({
      confirmationEmail: intent.email,
      returnToUrl: "/environments/env-1/settings/profile",
      userId: intent.userId,
    });

    expect(result.authorizationParams).toEqual({
      login: intent.email,
      prompt: "select_account",
    });
    expect(result.provider).toBe("github");
  });

  test("starts SAML SSO identity confirmation with Jackson routing and ForceAuthn params", async () => {
    mockGetUserAuthenticationData.mockResolvedValue({
      email: intent.email,
      identityProvider: "saml",
      identityProviderAccountId: intent.providerAccountId,
      password: null,
    } as any);
    mockCreateAccountDeletionSsoReauthIntent.mockReturnValue("intent-token");

    const result = await startAccountDeletionSsoReauthentication({
      confirmationEmail: intent.email,
      returnToUrl: "/environments/env-1/settings/profile",
      userId: intent.userId,
    });

    expect(result).toEqual({
      authorizationParams: {
        forceAuthn: "true",
        product: "formbricks",
        provider: "saml",
        tenant: "formbricks.com",
      },
      callbackUrl: "http://localhost:3000/auth/account-deletion/sso/complete?intent=intent-token",
      provider: "saml",
    });
  });

  test("extracts confirmation intents only from the expected callback URL", () => {
    expect(
      getAccountDeletionSsoReauthIntentFromCallbackUrl(
        "http://localhost:3000/auth/account-deletion/sso/complete?intent=intent-token"
      )
    ).toBe("intent-token");
    expect(
      getAccountDeletionSsoReauthIntentFromCallbackUrl("http://localhost:3000/auth/login?intent=intent-token")
    ).toBeNull();
    expect(
      getAccountDeletionSsoReauthIntentFromCallbackUrl(
        "https://evil.example/auth/account-deletion/sso/complete?intent=intent-token"
      )
    ).toBeNull();
  });

  test("builds a safe profile redirect for SSO identity confirmation callback failures", () => {
    mockVerifyAccountDeletionSsoReauthIntent.mockReturnValue(intent);

    expect(
      getAccountDeletionSsoReauthFailureRedirectUrl({
        intentToken: "intent-token",
      })
    ).toBe(
      `http://localhost:3000/environments/env-1/settings/profile?${ACCOUNT_DELETION_SSO_REAUTH_ERROR_QUERY_PARAM}=${ACCOUNT_DELETION_SSO_REAUTH_FAILED_ERROR_CODE}`
    );
  });

  test("falls back to the web app URL when the return URL is unsafe", async () => {
    mockGetUserAuthenticationData.mockResolvedValue({
      email: intent.email,
      identityProvider: "google",
      identityProviderAccountId: intent.providerAccountId,
      password: null,
    } as any);
    mockCreateAccountDeletionSsoReauthIntent.mockReturnValue("intent-token");

    await startAccountDeletionSsoReauthentication({
      confirmationEmail: intent.email,
      returnToUrl: "https://evil.example/phish",
      userId: intent.userId,
    });

    expect(mockCreateAccountDeletionSsoReauthIntent).toHaveBeenCalledWith(
      expect.objectContaining({
        returnToUrl: "http://localhost:3000",
      })
    );
  });

  test("does not start SSO identity confirmation for password-backed users", async () => {
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

  test("does not start SSO identity confirmation when the confirmation email mismatches", async () => {
    mockGetUserAuthenticationData.mockResolvedValue({
      email: intent.email,
      identityProvider: "google",
      identityProviderAccountId: intent.providerAccountId,
      password: null,
    } as any);

    await expect(
      startAccountDeletionSsoReauthentication({
        confirmationEmail: "attacker@example.com",
        returnToUrl: "/environments/env-1/settings/profile",
        userId: intent.userId,
      })
    ).rejects.toThrow(AuthorizationError);

    expect(mockCache.set).not.toHaveBeenCalled();
  });

  test("does not start SSO identity confirmation without a linked SSO provider account", async () => {
    mockGetUserAuthenticationData.mockResolvedValue({
      email: intent.email,
      identityProvider: "google",
      identityProviderAccountId: null,
      password: null,
    } as any);

    await expect(
      startAccountDeletionSsoReauthentication({
        confirmationEmail: intent.email,
        returnToUrl: "/environments/env-1/settings/profile",
        userId: intent.userId,
      })
    ).rejects.toThrow(AuthorizationError);

    expect(mockCache.set).not.toHaveBeenCalled();
  });

  test("fails SSO start when the intent cannot be cached", async () => {
    mockGetUserAuthenticationData.mockResolvedValue({
      email: intent.email,
      identityProvider: "google",
      identityProviderAccountId: intent.providerAccountId,
      password: null,
    } as any);
    mockCache.set.mockResolvedValueOnce({ ok: false, error: cacheError });

    await expect(
      startAccountDeletionSsoReauthentication({
        confirmationEmail: intent.email,
        returnToUrl: "/environments/env-1/settings/profile",
        userId: intent.userId,
      })
    ).rejects.toThrow("Unable to start account deletion SSO identity confirmation");

    expect(mockCreateAccountDeletionSsoReauthIntent).not.toHaveBeenCalled();
  });

  test("validates a matching SSO callback before the normal SSO handler runs", async () => {
    mockVerifyAccountDeletionSsoReauthIntent.mockReturnValue(intent);
    mockCache.get.mockResolvedValue({ ok: true, data: storedIntent });

    await expect(
      validateAccountDeletionSsoReauthenticationCallback({
        account: {
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

  test("validates a matching SAML callback without AuthnInstant freshness proof", async () => {
    mockVerifyAccountDeletionSsoReauthIntent.mockReturnValue(samlIntent);
    mockCache.get.mockResolvedValue({ ok: true, data: storedSamlIntent });

    await expect(
      validateAccountDeletionSsoReauthenticationCallback({
        account: {
          provider: "saml",
          providerAccountId: samlIntent.providerAccountId,
          type: "oauth",
        } as any,
        intentToken: "intent-token",
      })
    ).resolves.toBeUndefined();

    expect(mockCache.get).toHaveBeenCalled();
    expect(mockCache.del).not.toHaveBeenCalled();
  });

  test("fails SSO completion without consuming the intent when the callback provider does not match", async () => {
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

    expect(mockCache.del).not.toHaveBeenCalled();
    expect(mockPrismaAccountFindUnique).not.toHaveBeenCalled();
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

  test("rejects callbacks when the signed intent is not for an SSO provider", async () => {
    mockVerifyAccountDeletionSsoReauthIntent.mockReturnValue({
      ...intent,
      provider: "email",
    });

    await expect(
      validateAccountDeletionSsoReauthenticationCallback({
        account: {
          provider: "google",
          providerAccountId: intent.providerAccountId,
          type: "oauth",
        } as any,
        intentToken: "intent-token",
      })
    ).rejects.toThrow(AuthorizationError);

    expect(mockCache.get).not.toHaveBeenCalled();
  });

  test("accepts GitHub callbacks because identity confirmation does not require freshness proof", async () => {
    const githubIntent = {
      ...intent,
      provider: "github",
      providerAccountId: "github-account-id",
    };
    mockVerifyAccountDeletionSsoReauthIntent.mockReturnValue(githubIntent);
    mockCache.get.mockResolvedValue({
      ok: true,
      data: {
        id: githubIntent.id,
        provider: githubIntent.provider,
        providerAccountId: githubIntent.providerAccountId,
        userId: githubIntent.userId,
      },
    });

    await expect(
      validateAccountDeletionSsoReauthenticationCallback({
        account: {
          provider: "github",
          providerAccountId: "github-account-id",
          type: "oauth",
        } as any,
        intentToken: "intent-token",
      })
    ).resolves.toBeUndefined();

    expect(mockCache.get).toHaveBeenCalled();
    expect(mockCache.del).not.toHaveBeenCalled();
  });

  test("rejects callbacks from unsupported account providers", async () => {
    mockVerifyAccountDeletionSsoReauthIntent.mockReturnValue(intent);

    await expect(
      validateAccountDeletionSsoReauthenticationCallback({
        account: {
          provider: "credentials",
          providerAccountId: intent.providerAccountId,
          type: "credentials",
        } as any,
        intentToken: "intent-token",
      })
    ).rejects.toThrow(AuthorizationError);

    expect(mockCache.get).not.toHaveBeenCalled();
  });

  test("stores a deletion marker after SSO identity confirmation", async () => {
    mockVerifyAccountDeletionSsoReauthIntent.mockReturnValue(intent);
    mockCache.get.mockResolvedValue({ ok: true, data: storedIntent });
    mockRedisConsume(storedIntent);
    mockPrismaAccountFindUnique.mockResolvedValue({ userId: intent.userId } as any);

    await completeAccountDeletionSsoReauthentication({
      account: {
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

  test("stores a deletion marker when the linked account is found through legacy user fields", async () => {
    mockVerifyAccountDeletionSsoReauthIntent.mockReturnValue(intent);
    mockCache.get.mockResolvedValue({ ok: true, data: storedIntent });
    mockRedisConsume(storedIntent);
    mockPrismaAccountFindUnique.mockResolvedValue(null);
    mockPrismaUserFindFirst.mockResolvedValue({ id: intent.userId } as any);

    await completeAccountDeletionSsoReauthentication({
      account: {
        provider: "google",
        providerAccountId: intent.providerAccountId,
        type: "oauth",
      } as any,
      intentToken: "intent-token",
    });

    expect(mockPrismaUserFindFirst).toHaveBeenCalledWith({
      where: {
        identityProvider: "google",
        identityProviderAccountId: intent.providerAccountId,
      },
      select: {
        id: true,
      },
    });
    expect(mockCache.set).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining(storedIntent),
      5 * 60 * 1000
    );
  });

  test("fails SSO completion when the provider account belongs to another user", async () => {
    mockVerifyAccountDeletionSsoReauthIntent.mockReturnValue(intent);
    mockCache.get.mockResolvedValue({ ok: true, data: storedIntent });
    mockPrismaAccountFindUnique.mockResolvedValue({ userId: "other-user-id" } as any);

    await expect(
      completeAccountDeletionSsoReauthentication({
        account: {
          provider: "google",
          providerAccountId: intent.providerAccountId,
          type: "oauth",
        } as any,
        intentToken: "intent-token",
      })
    ).rejects.toThrow(AuthorizationError);

    expect(mockCache.del).not.toHaveBeenCalled();
  });

  test("fails SSO completion when the cached intent does not match the signed intent", async () => {
    mockVerifyAccountDeletionSsoReauthIntent.mockReturnValue(intent);
    mockCache.get.mockResolvedValue({
      ok: true,
      data: {
        ...storedIntent,
        providerAccountId: "different-provider-account-id",
      },
    });

    await expect(
      completeAccountDeletionSsoReauthentication({
        account: {
          provider: "google",
          providerAccountId: intent.providerAccountId,
          type: "oauth",
        } as any,
        intentToken: "intent-token",
      })
    ).rejects.toThrow(AuthorizationError);

    expect(mockPrismaAccountFindUnique).not.toHaveBeenCalled();
    expect(mockCache.del).not.toHaveBeenCalled();
  });

  test("fails SSO completion when the deletion marker cannot be cached", async () => {
    mockVerifyAccountDeletionSsoReauthIntent.mockReturnValue(intent);
    mockCache.get.mockResolvedValue({ ok: true, data: storedIntent });
    mockRedisConsume(storedIntent);
    mockCache.set.mockResolvedValueOnce({ ok: false, error: cacheError });
    mockPrismaAccountFindUnique.mockResolvedValue({ userId: intent.userId } as any);

    await expect(
      completeAccountDeletionSsoReauthentication({
        account: {
          provider: "google",
          providerAccountId: intent.providerAccountId,
          type: "oauth",
        } as any,
        intentToken: "intent-token",
      })
    ).rejects.toThrow("Unable to complete account deletion SSO identity confirmation");
  });

  test("surfaces cache read failures while validating callbacks", async () => {
    mockVerifyAccountDeletionSsoReauthIntent.mockReturnValue(intent);
    mockCache.get.mockResolvedValue({ ok: false, error: cacheError });

    await expect(
      validateAccountDeletionSsoReauthenticationCallback({
        account: {
          provider: "google",
          providerAccountId: intent.providerAccountId,
          type: "oauth",
        } as any,
        intentToken: "intent-token",
      })
    ).rejects.toThrow("Unable to read account deletion SSO identity confirmation value");
  });

  test("requires a completed SSO identity confirmation marker before deleting an SSO account", async () => {
    mockRedisConsume(null);

    await expect(
      consumeAccountDeletionSsoReauthentication({
        identityProvider: "google",
        providerAccountId: intent.providerAccountId,
        userId: intent.userId,
      })
    ).rejects.toThrow(AuthorizationError);
  });

  test("consumes a valid SSO identity confirmation marker", async () => {
    const redisEval = mockRedisConsume({
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

    expect(redisEval).toHaveBeenCalledWith(expect.any(String), {
      arguments: [],
      keys: [expect.any(String)],
    });
    expect(mockCache.get).not.toHaveBeenCalled();
    expect(mockCache.del).not.toHaveBeenCalled();
  });

  test("fails closed when atomic Redis consumption is unavailable", async () => {
    await expect(
      consumeAccountDeletionSsoReauthentication({
        identityProvider: "google",
        providerAccountId: intent.providerAccountId,
        userId: intent.userId,
      })
    ).rejects.toThrow("Unable to consume account deletion SSO identity confirmation value");

    expect(mockCache.get).not.toHaveBeenCalled();
    expect(mockCache.del).not.toHaveBeenCalled();
  });

  test("rejects unexpected Redis values while consuming a marker", async () => {
    mockCache.getRedisClient.mockResolvedValueOnce({
      eval: vi.fn().mockResolvedValue(42),
    } as any);

    await expect(
      consumeAccountDeletionSsoReauthentication({
        identityProvider: "google",
        providerAccountId: intent.providerAccountId,
        userId: intent.userId,
      })
    ).rejects.toThrow("Unexpected cached account deletion SSO identity confirmation value");
  });

  test("surfaces atomic Redis failures while consuming a marker", async () => {
    mockCache.getRedisClient.mockResolvedValueOnce({
      eval: vi.fn().mockRejectedValue(new Error("Redis consume failed")),
    } as any);

    await expect(
      consumeAccountDeletionSsoReauthentication({
        identityProvider: "google",
        providerAccountId: intent.providerAccountId,
        userId: intent.userId,
      })
    ).rejects.toThrow("Redis consume failed");
  });

  test("rejects a marker for a different provider account", async () => {
    mockRedisConsume({
      ...storedIntent,
      completedAt: Date.now(),
      providerAccountId: "different-provider-account-id",
    });

    await expect(
      consumeAccountDeletionSsoReauthentication({
        identityProvider: "google",
        providerAccountId: intent.providerAccountId,
        userId: intent.userId,
      })
    ).rejects.toThrow(AuthorizationError);

    expect(mockCache.get).not.toHaveBeenCalled();
    expect(mockCache.del).not.toHaveBeenCalled();
  });

  test("rejects an expired SSO identity confirmation marker", async () => {
    mockRedisConsume({
      ...storedIntent,
      completedAt: Date.now() - 6 * 60 * 1000,
    });

    await expect(
      consumeAccountDeletionSsoReauthentication({
        identityProvider: "google",
        providerAccountId: intent.providerAccountId,
        userId: intent.userId,
      })
    ).rejects.toThrow(AuthorizationError);

    expect(mockCache.get).not.toHaveBeenCalled();
    expect(mockCache.del).not.toHaveBeenCalled();
  });
});
