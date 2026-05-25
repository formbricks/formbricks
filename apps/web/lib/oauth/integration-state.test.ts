import { beforeEach, describe, expect, test, vi } from "vitest";
import { ErrorCode } from "@formbricks/cache";
import { logger } from "@formbricks/logger";
import { cache } from "@/lib/cache";
import {
  IntegrationOAuthStateError,
  consumeIntegrationOAuthState,
  createIntegrationOAuthState,
  generatePkcePair,
  getSafeOAuthCallbackError,
} from "./integration-state";

vi.mock("@formbricks/logger", () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock("@/lib/cache", () => ({
  cache: {
    getRedisClient: vi.fn(),
    set: vi.fn(),
  },
}));

const mockCache = vi.mocked(cache);

const oauthStatePayload = {
  createdAt: Date.now(),
  provider: "slack",
  userId: "user-1",
  workspaceId: "workspace-1",
} as const;

const mockRedisConsume = (value: unknown) => {
  const evalMock = vi.fn().mockResolvedValue(value === null ? null : JSON.stringify(value));
  mockCache.getRedisClient.mockResolvedValueOnce({ eval: evalMock } as any);
  return evalMock;
};

describe("integration OAuth state", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockCache.set.mockResolvedValue({ ok: true, data: undefined });
  });

  test("creates an opaque cached state that does not expose the workspace id", async () => {
    const state = await createIntegrationOAuthState({
      provider: "slack",
      userId: oauthStatePayload.userId,
      workspaceId: oauthStatePayload.workspaceId,
    });

    expect(state).toMatch(/^[A-Za-z0-9_-]{43,128}$/);
    expect(state).not.toContain(oauthStatePayload.workspaceId);
    expect(mockCache.set).toHaveBeenCalledWith(
      "fb:oauth:state:fake-hash",
      expect.objectContaining({
        provider: oauthStatePayload.provider,
        userId: oauthStatePayload.userId,
        workspaceId: oauthStatePayload.workspaceId,
      }),
      10 * 60 * 1000
    );
  });

  test("stores the PKCE verifier with Airtable OAuth state", async () => {
    const pkceCodeVerifier = "E".repeat(43);

    await createIntegrationOAuthState({
      pkceCodeVerifier,
      provider: "airtable",
      userId: oauthStatePayload.userId,
      workspaceId: oauthStatePayload.workspaceId,
    });

    expect(mockCache.set).toHaveBeenCalledWith(
      "fb:oauth:state:fake-hash",
      expect.objectContaining({ pkceCodeVerifier }),
      10 * 60 * 1000
    );
  });

  test("consumes a valid state atomically and returns the stored workspace", async () => {
    const state = await createIntegrationOAuthState({
      provider: "slack",
      userId: oauthStatePayload.userId,
      workspaceId: oauthStatePayload.workspaceId,
    });
    const redisEval = mockRedisConsume(oauthStatePayload);

    const consumedState = await consumeIntegrationOAuthState({
      provider: "slack",
      userId: oauthStatePayload.userId,
      state,
    });

    expect(consumedState).toEqual(oauthStatePayload);
    expect(redisEval).toHaveBeenCalledWith(expect.stringContaining('redis.call("GET", KEYS[1])'), {
      arguments: [],
      keys: ["fb:oauth:state:fake-hash"],
    });
    expect(redisEval).toHaveBeenCalledWith(expect.stringContaining('redis.call("DEL", KEYS[1])'), {
      arguments: [],
      keys: ["fb:oauth:state:fake-hash"],
    });

    mockRedisConsume(null);

    await expect(
      consumeIntegrationOAuthState({
        provider: "slack",
        userId: oauthStatePayload.userId,
        state,
      })
    ).rejects.toThrow(IntegrationOAuthStateError);
  });

  test("rejects reused or unknown states", async () => {
    mockRedisConsume(null);

    await expect(
      consumeIntegrationOAuthState({
        provider: "slack",
        userId: oauthStatePayload.userId,
        state: "A".repeat(43),
      })
    ).rejects.toThrow(IntegrationOAuthStateError);
  });

  test("rejects malformed callback state before reading Redis", async () => {
    await expect(
      consumeIntegrationOAuthState({
        provider: "slack",
        userId: oauthStatePayload.userId,
        state: "too-short",
      })
    ).rejects.toThrow(IntegrationOAuthStateError);

    expect(mockCache.getRedisClient).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalled();
  });

  test("rejects wrong provider and wrong user states", async () => {
    mockRedisConsume(oauthStatePayload);

    await expect(
      consumeIntegrationOAuthState({
        provider: "notion",
        userId: oauthStatePayload.userId,
        state: "B".repeat(43),
      })
    ).rejects.toThrow(IntegrationOAuthStateError);

    mockRedisConsume(oauthStatePayload);

    await expect(
      consumeIntegrationOAuthState({
        provider: "slack",
        userId: "user-2",
        state: "C".repeat(43),
      })
    ).rejects.toThrow(IntegrationOAuthStateError);
  });

  test("fails closed when cache storage or Redis is unavailable", async () => {
    mockCache.set.mockResolvedValueOnce({ ok: false, error: { code: ErrorCode.RedisConnectionError } });

    await expect(
      createIntegrationOAuthState({
        provider: "slack",
        userId: oauthStatePayload.userId,
        workspaceId: oauthStatePayload.workspaceId,
      })
    ).rejects.toThrow("Unable to start OAuth flow");

    mockCache.getRedisClient.mockResolvedValueOnce(null);

    await expect(
      consumeIntegrationOAuthState({
        provider: "slack",
        userId: oauthStatePayload.userId,
        state: "D".repeat(43),
      })
    ).rejects.toThrow(IntegrationOAuthStateError);

    expect(logger.error).toHaveBeenCalled();
  });

  test("fails closed when Redis client resolution throws", async () => {
    mockCache.getRedisClient.mockRejectedValueOnce(new Error("Redis unavailable"));

    await expect(
      consumeIntegrationOAuthState({
        provider: "slack",
        userId: oauthStatePayload.userId,
        state: "I".repeat(43),
      })
    ).rejects.toThrow(IntegrationOAuthStateError);

    expect(logger.error).toHaveBeenCalled();
  });

  test("rejects malformed cached state values", async () => {
    mockRedisConsume({
      createdAt: Date.now(),
      provider: "slack",
      userId: oauthStatePayload.userId,
    });

    await expect(
      consumeIntegrationOAuthState({
        provider: "slack",
        userId: oauthStatePayload.userId,
        state: "F".repeat(43),
      })
    ).rejects.toThrow(IntegrationOAuthStateError);

    expect(logger.error).toHaveBeenCalled();
  });

  test("rejects unexpected cached value types", async () => {
    mockCache.getRedisClient.mockResolvedValueOnce({
      eval: vi.fn().mockResolvedValue(42),
    } as any);

    await expect(
      consumeIntegrationOAuthState({
        provider: "slack",
        userId: oauthStatePayload.userId,
        state: "G".repeat(43),
      })
    ).rejects.toThrow(IntegrationOAuthStateError);

    expect(logger.error).toHaveBeenCalled();
  });

  test("fails closed when atomic cache consumption fails", async () => {
    mockCache.getRedisClient.mockResolvedValueOnce({
      eval: vi.fn().mockRejectedValue(new Error("Redis failed")),
    } as any);

    await expect(
      consumeIntegrationOAuthState({
        provider: "slack",
        userId: oauthStatePayload.userId,
        state: "H".repeat(43),
      })
    ).rejects.toThrow(IntegrationOAuthStateError);

    expect(logger.error).toHaveBeenCalled();
  });

  test("generates an RFC 7636 S256 PKCE pair", () => {
    const { codeChallenge, codeChallengeMethod, codeVerifier } = generatePkcePair();

    expect(codeVerifier).toMatch(/^[A-Za-z0-9_-]{43,128}$/);
    expect(codeChallenge).toBe("fake-hash");
    expect(codeChallengeMethod).toBe("S256");
  });

  test("sanitizes provider callback errors", () => {
    expect(getSafeOAuthCallbackError("access_denied")).toBe("access_denied");
    expect(getSafeOAuthCallbackError("https://evil.example")).toBe("oauth_error");
    expect(getSafeOAuthCallbackError(null)).toBeNull();
  });
});
