import "server-only";
import type { IdentityProvider } from "@prisma/client";
import jwt, { type JwtPayload } from "jsonwebtoken";
import type { Account } from "next-auth";
import { createCacheKey } from "@formbricks/cache";
import { prisma } from "@formbricks/database";
import { logger } from "@formbricks/logger";
import { AuthorizationError, InvalidInputError } from "@formbricks/types/errors";
import { cache } from "@/lib/cache";
import { SAML_PRODUCT, SAML_TENANT, WEBAPP_URL } from "@/lib/constants";
import { createAccountDeletionSsoReauthIntent, verifyAccountDeletionSsoReauthIntent } from "@/lib/jwt";
import { getUserAuthenticationData } from "@/lib/user/password";
import { getValidatedCallbackUrl } from "@/lib/utils/url";
import {
  ACCOUNT_DELETION_SSO_REAUTH_CALLBACK_PATH,
  DELETE_ACCOUNT_SSO_REAUTH_REQUIRED_ERROR,
} from "@/modules/account/constants";
import {
  getSsoProviderLookupCandidates,
  normalizeSsoProvider,
} from "@/modules/ee/sso/lib/provider-normalization";

const ACCOUNT_DELETION_SSO_REAUTH_INTENT_TTL_MS = 10 * 60 * 1000;
const ACCOUNT_DELETION_SSO_REAUTH_MARKER_TTL_MS = 5 * 60 * 1000;
const OIDC_AUTH_TIME_MAX_AGE_SECONDS = 5 * 60;
const OIDC_AUTH_TIME_FUTURE_SKEW_SECONDS = 60;

type TSsoIdentityProvider = Exclude<IdentityProvider, "email">;

type TStoredAccountDeletionSsoReauthIntent = {
  id: string;
  provider: TSsoIdentityProvider;
  providerAccountId: string;
  userId: string;
};

type TAccountDeletionSsoReauthMarker = TStoredAccountDeletionSsoReauthIntent & {
  completedAt: number;
};

type TStartAccountDeletionSsoReauthenticationInput = {
  confirmationEmail: string;
  returnToUrl: string;
  userId: string;
};

export type TStartAccountDeletionSsoReauthenticationResult = {
  authorizationParams: Record<string, string>;
  callbackUrl: string;
  provider: string;
};

const NEXT_AUTH_PROVIDER_BY_IDENTITY_PROVIDER = {
  azuread: "azure-ad",
  github: "github",
  google: "google",
  openid: "openid",
  saml: "saml",
} as const satisfies Record<TSsoIdentityProvider, string>;

const OIDC_REAUTH_PROVIDERS = new Set<IdentityProvider>(["azuread", "google", "openid"]);

const getAccountDeletionSsoReauthIntentKey = (intentId: string) =>
  createCacheKey.custom("account_deletion", "sso_reauth_intent", intentId);

const getAccountDeletionSsoReauthMarkerKey = (userId: string) =>
  createCacheKey.custom("account_deletion", userId, "sso_reauth_complete");

const getSsoIdentityProviderOrThrow = (
  identityProvider: IdentityProvider,
  providerAccountId: string | null
): { provider: TSsoIdentityProvider; providerAccountId: string } => {
  if (identityProvider === "email" || !providerAccountId) {
    throw new AuthorizationError(DELETE_ACCOUNT_SSO_REAUTH_REQUIRED_ERROR);
  }

  return { provider: identityProvider, providerAccountId };
};

const getAccountDeletionSsoReauthAuthorizationParams = (
  provider: TSsoIdentityProvider,
  email: string
): Record<string, string> => {
  if (provider === "saml") {
    return {
      forceAuthn: "true",
      product: SAML_PRODUCT,
      provider: "saml",
      tenant: SAML_TENANT,
    };
  }

  if (OIDC_REAUTH_PROVIDERS.has(provider)) {
    return {
      login_hint: email,
      max_age: "0",
      prompt: "login",
    };
  }

  return {
    login: email,
    prompt: "login",
  };
};

const createAccountDeletionSsoReauthCallbackUrl = (intentToken: string) => {
  const callbackUrl = new URL(ACCOUNT_DELETION_SSO_REAUTH_CALLBACK_PATH, WEBAPP_URL);
  callbackUrl.searchParams.set("intent", intentToken);
  return callbackUrl.toString();
};

export const getAccountDeletionSsoReauthIntentFromCallbackUrl = (callbackUrl: string): string | null => {
  const validatedCallbackUrl = getValidatedCallbackUrl(callbackUrl, WEBAPP_URL);

  if (!validatedCallbackUrl) {
    return null;
  }

  const parsedCallbackUrl = new URL(validatedCallbackUrl);

  if (parsedCallbackUrl.pathname !== ACCOUNT_DELETION_SSO_REAUTH_CALLBACK_PATH) {
    return null;
  }

  return parsedCallbackUrl.searchParams.get("intent");
};

const storeAccountDeletionSsoReauthIntent = async (intent: TStoredAccountDeletionSsoReauthIntent) => {
  const cacheKey = getAccountDeletionSsoReauthIntentKey(intent.id);
  const result = await cache.set(cacheKey, intent, ACCOUNT_DELETION_SSO_REAUTH_INTENT_TTL_MS);

  if (!result.ok) {
    logger.error(
      { error: result.error, intentId: intent.id, userId: intent.userId },
      "Failed to store SSO reauth intent"
    );
    throw new Error("Unable to start account deletion SSO reauthentication");
  }
};

const storeAccountDeletionSsoReauthMarker = async (marker: TAccountDeletionSsoReauthMarker) => {
  const cacheKey = getAccountDeletionSsoReauthMarkerKey(marker.userId);
  const result = await cache.set(cacheKey, marker, ACCOUNT_DELETION_SSO_REAUTH_MARKER_TTL_MS);

  if (!result.ok) {
    logger.error(
      { error: result.error, intentId: marker.id, userId: marker.userId },
      "Failed to store account deletion SSO reauth marker"
    );
    throw new Error("Unable to complete account deletion SSO reauthentication");
  }
};

const consumeCachedJsonValue = async <TValue>(key: string, logContext: Record<string, unknown>) => {
  let redis;

  try {
    redis = await cache.getRedisClient();
  } catch (error) {
    logger.error({ ...logContext, error, key }, "Failed to resolve Redis client for SSO reauth cache");
    throw error;
  }

  if (redis) {
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
          keys: [key],
        }
      );

      if (serializedValue === null) {
        return null;
      }

      if (typeof serializedValue !== "string") {
        logger.error({ ...logContext, key, serializedValue }, "Unexpected cached SSO reauth value");
        throw new Error("Unexpected cached account deletion SSO reauth value");
      }

      return JSON.parse(serializedValue) as TValue;
    } catch (error) {
      logger.error({ ...logContext, error, key }, "Failed to atomically consume SSO reauth cache value");
      throw error;
    }
  }

  const cacheResult = await cache.get<TValue>(key);

  if (!cacheResult.ok) {
    logger.error({ ...logContext, error: cacheResult.error, key }, "Failed to read SSO reauth cache value");
    throw new Error("Unable to read account deletion SSO reauth value");
  }

  if (!cacheResult.data) {
    return null;
  }

  const deleteResult = await cache.del([key]);

  if (!deleteResult.ok) {
    logger.error(
      { ...logContext, error: deleteResult.error, key },
      "Failed to consume SSO reauth cache value"
    );
    throw new Error("Unable to consume account deletion SSO reauth value");
  }

  return cacheResult.data;
};

const getCachedJsonValue = async <TValue>(key: string, logContext: Record<string, unknown>) => {
  const cacheResult = await cache.get<TValue>(key);

  if (!cacheResult.ok) {
    logger.error({ ...logContext, error: cacheResult.error, key }, "Failed to read SSO reauth cache value");
    throw new Error("Unable to read account deletion SSO reauth value");
  }

  return cacheResult.data;
};

const assertStoredAccountDeletionSsoReauthIntentMatches = (
  cachedIntent: TStoredAccountDeletionSsoReauthIntent | null,
  intent: TStoredAccountDeletionSsoReauthIntent
) => {
  if (
    !cachedIntent ||
    cachedIntent.userId !== intent.userId ||
    cachedIntent.provider !== intent.provider ||
    cachedIntent.providerAccountId !== intent.providerAccountId
  ) {
    throw new AuthorizationError(DELETE_ACCOUNT_SSO_REAUTH_REQUIRED_ERROR);
  }
};

const consumeStoredAccountDeletionSsoReauthIntent = async (intent: TStoredAccountDeletionSsoReauthIntent) => {
  const cachedIntent = await consumeCachedJsonValue<TStoredAccountDeletionSsoReauthIntent>(
    getAccountDeletionSsoReauthIntentKey(intent.id),
    {
      intentId: intent.id,
      userId: intent.userId,
    }
  );

  assertStoredAccountDeletionSsoReauthIntentMatches(cachedIntent, intent);
};

const assertStoredAccountDeletionSsoReauthIntentExists = async (
  intent: TStoredAccountDeletionSsoReauthIntent
) => {
  const cachedIntent = await getCachedJsonValue<TStoredAccountDeletionSsoReauthIntent>(
    getAccountDeletionSsoReauthIntentKey(intent.id),
    {
      intentId: intent.id,
      userId: intent.userId,
    }
  );

  assertStoredAccountDeletionSsoReauthIntentMatches(cachedIntent, intent);
};

const findLinkedSsoUserId = async ({
  provider,
  providerAccountId,
}: {
  provider: TSsoIdentityProvider;
  providerAccountId: string;
}) => {
  const lookupCandidates = getSsoProviderLookupCandidates(provider);

  for (const lookupProvider of lookupCandidates) {
    const account = await prisma.account.findUnique({
      where: {
        provider_providerAccountId: {
          provider: lookupProvider,
          providerAccountId,
        },
      },
      select: {
        userId: true,
      },
    });

    if (account) {
      return account.userId;
    }
  }

  const legacyUser = await prisma.user.findFirst({
    where: {
      identityProvider: provider,
      identityProviderAccountId: providerAccountId,
    },
    select: {
      id: true,
    },
  });

  return legacyUser?.id ?? null;
};

const assertFreshOidcAuthTime = (provider: TSsoIdentityProvider, idToken?: string) => {
  if (!OIDC_REAUTH_PROVIDERS.has(provider)) {
    return;
  }

  if (!idToken) {
    throw new AuthorizationError(DELETE_ACCOUNT_SSO_REAUTH_REQUIRED_ERROR);
  }

  const decodedToken = jwt.decode(idToken) as JwtPayload | string | null;

  if (!decodedToken || typeof decodedToken === "string") {
    throw new AuthorizationError(DELETE_ACCOUNT_SSO_REAUTH_REQUIRED_ERROR);
  }

  const { auth_time: authTime } = decodedToken;

  if (typeof authTime !== "number") {
    throw new AuthorizationError(DELETE_ACCOUNT_SSO_REAUTH_REQUIRED_ERROR);
  }

  const nowInSeconds = Math.floor(Date.now() / 1000);
  const isTooOld = nowInSeconds - authTime > OIDC_AUTH_TIME_MAX_AGE_SECONDS;
  const isFromTheFuture = authTime - nowInSeconds > OIDC_AUTH_TIME_FUTURE_SKEW_SECONDS;

  if (isTooOld || isFromTheFuture) {
    throw new AuthorizationError(DELETE_ACCOUNT_SSO_REAUTH_REQUIRED_ERROR);
  }
};

const getVerifiedAccountDeletionSsoReauthIntent = (intentToken: string) => {
  const intent = verifyAccountDeletionSsoReauthIntent(intentToken);
  const provider = normalizeSsoProvider(intent.provider);

  if (!provider || provider === "email") {
    throw new AuthorizationError(DELETE_ACCOUNT_SSO_REAUTH_REQUIRED_ERROR);
  }

  return {
    intent,
    storedIntent: {
      id: intent.id,
      provider,
      providerAccountId: intent.providerAccountId,
      userId: intent.userId,
    },
  };
};

const getNormalizedSsoProviderFromAccount = (account: Account) => {
  const normalizedProvider = normalizeSsoProvider(account.provider);

  if (!normalizedProvider || normalizedProvider === "email") {
    throw new AuthorizationError(DELETE_ACCOUNT_SSO_REAUTH_REQUIRED_ERROR);
  }

  return normalizedProvider;
};

const assertAccountMatchesIntent = ({
  account,
  intentProvider,
  provider,
  providerAccountId,
}: {
  account: Account;
  intentProvider: string;
  provider: TSsoIdentityProvider;
  providerAccountId: string;
}) => {
  if (provider !== intentProvider || account.providerAccountId !== providerAccountId) {
    throw new AuthorizationError(DELETE_ACCOUNT_SSO_REAUTH_REQUIRED_ERROR);
  }
};

export const startAccountDeletionSsoReauthentication = async ({
  confirmationEmail,
  returnToUrl,
  userId,
}: TStartAccountDeletionSsoReauthenticationInput): Promise<TStartAccountDeletionSsoReauthenticationResult> => {
  const userAuthenticationData = await getUserAuthenticationData(userId);

  if (confirmationEmail.toLowerCase() !== userAuthenticationData.email.toLowerCase()) {
    throw new AuthorizationError("Email confirmation does not match");
  }

  if (userAuthenticationData.password) {
    throw new InvalidInputError("Password confirmation is required to delete this account");
  }

  const { provider, providerAccountId } = getSsoIdentityProviderOrThrow(
    userAuthenticationData.identityProvider,
    userAuthenticationData.identityProviderAccountId
  );
  const intentId = crypto.randomUUID();
  const validatedReturnToUrl = getValidatedCallbackUrl(returnToUrl, WEBAPP_URL) ?? WEBAPP_URL;

  await storeAccountDeletionSsoReauthIntent({
    id: intentId,
    provider,
    providerAccountId,
    userId,
  });

  const intentToken = createAccountDeletionSsoReauthIntent({
    id: intentId,
    email: userAuthenticationData.email,
    provider,
    providerAccountId,
    purpose: "account_deletion_sso_reauth",
    returnToUrl: validatedReturnToUrl,
    userId,
  });

  return {
    authorizationParams: getAccountDeletionSsoReauthAuthorizationParams(
      provider,
      userAuthenticationData.email
    ),
    callbackUrl: createAccountDeletionSsoReauthCallbackUrl(intentToken),
    provider: NEXT_AUTH_PROVIDER_BY_IDENTITY_PROVIDER[provider],
  };
};

export const completeAccountDeletionSsoReauthentication = async ({
  account,
  intentToken,
}: {
  account: Account;
  intentToken: string;
}) => {
  const { intent, storedIntent } = getVerifiedAccountDeletionSsoReauthIntent(intentToken);
  const normalizedProvider = getNormalizedSsoProviderFromAccount(account);

  await consumeStoredAccountDeletionSsoReauthIntent(storedIntent);
  assertAccountMatchesIntent({
    account,
    intentProvider: intent.provider,
    provider: normalizedProvider,
    providerAccountId: intent.providerAccountId,
  });

  assertFreshOidcAuthTime(normalizedProvider, account.id_token);

  const linkedUserId = await findLinkedSsoUserId({
    provider: normalizedProvider,
    providerAccountId: account.providerAccountId,
  });

  if (linkedUserId !== intent.userId) {
    throw new AuthorizationError(DELETE_ACCOUNT_SSO_REAUTH_REQUIRED_ERROR);
  }

  await storeAccountDeletionSsoReauthMarker({
    completedAt: Date.now(),
    id: intent.id,
    provider: normalizedProvider,
    providerAccountId: account.providerAccountId,
    userId: intent.userId,
  });
};

export const validateAccountDeletionSsoReauthenticationCallback = async ({
  account,
  intentToken,
}: {
  account: Account;
  intentToken: string;
}) => {
  const { intent, storedIntent } = getVerifiedAccountDeletionSsoReauthIntent(intentToken);
  const normalizedProvider = getNormalizedSsoProviderFromAccount(account);

  assertAccountMatchesIntent({
    account,
    intentProvider: intent.provider,
    provider: normalizedProvider,
    providerAccountId: intent.providerAccountId,
  });
  assertFreshOidcAuthTime(normalizedProvider, account.id_token);
  await assertStoredAccountDeletionSsoReauthIntentExists(storedIntent);
};

export const consumeAccountDeletionSsoReauthentication = async ({
  identityProvider,
  providerAccountId,
  userId,
}: {
  identityProvider: IdentityProvider;
  providerAccountId: string | null;
  userId: string;
}) => {
  const { provider, providerAccountId: ssoProviderAccountId } = getSsoIdentityProviderOrThrow(
    identityProvider,
    providerAccountId
  );
  const marker = await consumeCachedJsonValue<TAccountDeletionSsoReauthMarker>(
    getAccountDeletionSsoReauthMarkerKey(userId),
    { userId }
  );

  if (
    !marker ||
    marker.userId !== userId ||
    marker.provider !== provider ||
    marker.providerAccountId !== ssoProviderAccountId ||
    Date.now() - marker.completedAt > ACCOUNT_DELETION_SSO_REAUTH_MARKER_TTL_MS
  ) {
    throw new AuthorizationError(DELETE_ACCOUNT_SSO_REAUTH_REQUIRED_ERROR);
  }
};
