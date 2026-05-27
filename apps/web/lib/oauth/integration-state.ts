import "server-only";
import crypto from "node:crypto";
import { createCacheKey } from "@formbricks/cache";
import { logger } from "@formbricks/logger";
import { cache } from "@/lib/cache";

const INTEGRATION_OAUTH_STATE_TTL_MS = 10 * 60 * 1000;
const OAUTH_STATE_ENTROPY_BYTES = 32;
const BASE64URL_TOKEN_REGEX = /^[A-Za-z0-9_-]{43,128}$/;
const SAFE_OAUTH_CALLBACK_ERRORS = new Set([
  "access_denied",
  "invalid_request",
  "invalid_scope",
  "server_error",
  "temporarily_unavailable",
]);

export type TIntegrationOAuthProvider = "googleSheets" | "slack" | "notion" | "airtable";

type TStoredIntegrationOAuthState = {
  provider: TIntegrationOAuthProvider;
  userId: string;
  workspaceId: string;
  pkceCodeVerifier?: string;
  createdAt: number;
};

type TCreateIntegrationOAuthStateInput = {
  provider: TIntegrationOAuthProvider;
  userId: string;
  workspaceId: string;
  pkceCodeVerifier?: string;
};

type TConsumeIntegrationOAuthStateInput = {
  provider: TIntegrationOAuthProvider;
  userId: string;
  state: string | null;
};

export class IntegrationOAuthStateError extends Error {
  constructor(message = "Invalid OAuth state") {
    super(message);
    this.name = "IntegrationOAuthStateError";
  }
}

const toBase64Url = (buffer: Buffer) =>
  buffer.toString("base64").replaceAll("=", "").replaceAll("+", "-").replaceAll("/", "_");

const generateRandomToken = () => toBase64Url(crypto.randomBytes(OAUTH_STATE_ENTROPY_BYTES));

const hashState = (state: string) => crypto.createHash("sha256").update(state).digest("hex");

const getIntegrationOAuthStateCacheKey = (stateHash: string) =>
  createCacheKey.custom("oauth", "state", stateHash);

const getValidToken = (token: string | undefined, label: string) => {
  if (!token || !BASE64URL_TOKEN_REGEX.test(token)) {
    throw new IntegrationOAuthStateError(`Invalid OAuth ${label}`);
  }

  return token;
};

const parseStoredIntegrationOAuthState = (serializedValue: string): TStoredIntegrationOAuthState => {
  try {
    const parsedValue = JSON.parse(serializedValue) as Partial<TStoredIntegrationOAuthState>;

    if (
      !parsedValue ||
      typeof parsedValue.provider !== "string" ||
      typeof parsedValue.userId !== "string" ||
      typeof parsedValue.workspaceId !== "string" ||
      typeof parsedValue.createdAt !== "number" ||
      (parsedValue.pkceCodeVerifier !== undefined && typeof parsedValue.pkceCodeVerifier !== "string")
    ) {
      throw new Error("Invalid stored OAuth state shape");
    }

    return parsedValue as TStoredIntegrationOAuthState;
  } catch (error) {
    logger.error({ error }, "Failed to parse stored integration OAuth state");
    throw new IntegrationOAuthStateError();
  }
};

const consumeCachedIntegrationOAuthState = async (
  cacheKey: string,
  logContext: Record<string, unknown>
): Promise<TStoredIntegrationOAuthState | null> => {
  let redis;

  try {
    redis = await cache.getRedisClient();
  } catch (error) {
    logger.error({ ...logContext, error }, "Failed to resolve Redis client for integration OAuth state");
    throw new IntegrationOAuthStateError("Unable to validate OAuth state");
  }

  if (!redis) {
    logger.error({ ...logContext }, "Redis is required to validate integration OAuth state");
    throw new IntegrationOAuthStateError("Unable to validate OAuth state");
  }

  try {
    const serializedValue = await redis.eval(
      `
        local value = redis.call("GET", KEYS[1])
        if value then
          redis.call("DEL", KEYS[1])
        end
        return value
      `,
      {
        arguments: [],
        keys: [cacheKey],
      }
    );

    if (serializedValue === null) {
      return null;
    }

    if (typeof serializedValue !== "string") {
      logger.error({ ...logContext }, "Unexpected cached integration OAuth state value");
      throw new IntegrationOAuthStateError();
    }

    return parseStoredIntegrationOAuthState(serializedValue);
  } catch (error) {
    if (error instanceof IntegrationOAuthStateError) {
      throw error;
    }

    logger.error({ ...logContext, error }, "Failed to consume integration OAuth state");
    throw new IntegrationOAuthStateError("Unable to validate OAuth state");
  }
};

export const createIntegrationOAuthState = async ({
  provider,
  userId,
  workspaceId,
  pkceCodeVerifier,
}: TCreateIntegrationOAuthStateInput): Promise<string> => {
  if (pkceCodeVerifier !== undefined) {
    getValidToken(pkceCodeVerifier, "PKCE verifier");
  }

  const state = generateRandomToken();
  const stateHash = hashState(state);
  const cacheKey = getIntegrationOAuthStateCacheKey(stateHash);
  const storedState: TStoredIntegrationOAuthState = {
    provider,
    userId,
    workspaceId,
    pkceCodeVerifier,
    createdAt: Date.now(),
  };

  const result = await cache.set(cacheKey, storedState, INTEGRATION_OAUTH_STATE_TTL_MS);

  if (!result.ok) {
    logger.error({ error: result.error, provider, userId, workspaceId }, "Failed to store OAuth state");
    throw new Error("Unable to start OAuth flow");
  }

  return state;
};

export const consumeIntegrationOAuthState = async ({
  provider,
  userId,
  state,
}: TConsumeIntegrationOAuthStateInput): Promise<TStoredIntegrationOAuthState> => {
  let providedState;

  try {
    providedState = getValidToken(state ?? undefined, "state");
  } catch (error) {
    logger.warn({ provider, userId }, "Integration OAuth callback rejected due to malformed state");
    throw error;
  }

  const stateHash = hashState(providedState);
  const cacheKey = getIntegrationOAuthStateCacheKey(stateHash);
  const storedState = await consumeCachedIntegrationOAuthState(cacheKey, { provider, stateHash, userId });

  if (storedState?.provider !== provider || storedState?.userId !== userId) {
    logger.warn({ provider, stateHash, userId }, "Integration OAuth callback rejected due to invalid state");
    throw new IntegrationOAuthStateError();
  }

  return storedState;
};

export const getSafeOAuthCallbackError = (error: string | null): string | null => {
  if (!error) {
    return null;
  }

  return SAFE_OAUTH_CALLBACK_ERRORS.has(error) ? error : "oauth_error";
};

export const generatePkcePair = () => {
  const verifier = generateRandomToken();
  const challenge = toBase64Url(crypto.createHash("sha256").update(verifier).digest());

  return {
    codeChallenge: challenge,
    codeChallengeMethod: "S256" as const,
    codeVerifier: verifier,
  };
};
