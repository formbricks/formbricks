import "server-only";
import type { IdentityProvider } from "@prisma/client";
import jwt from "jsonwebtoken";
import type { Account } from "next-auth";
import { createCacheKey } from "@formbricks/cache";
import { prisma } from "@formbricks/database";
import { logger } from "@formbricks/logger";
import { AuthorizationError, InvalidInputError } from "@formbricks/types/errors";
import { cache } from "@/lib/cache";
import {
  GOOGLE_ACCOUNT_DELETION_REAUTH_ENABLED,
  SAML_PRODUCT,
  SAML_TENANT,
  WEBAPP_URL,
} from "@/lib/constants";
import { createAccountDeletionSsoReauthIntent, verifyAccountDeletionSsoReauthIntent } from "@/lib/jwt";
import { getUserAuthenticationData } from "@/lib/user/password";
import { getValidatedCallbackUrl } from "@/lib/utils/url";
import {
  ACCOUNT_DELETION_CONFIRMATION_REQUIRED_ERROR_CODE,
  ACCOUNT_DELETION_EMAIL_MISMATCH_ERROR_CODE,
  ACCOUNT_DELETION_GOOGLE_REAUTH_NOT_CONFIGURED_ERROR_CODE,
  ACCOUNT_DELETION_SSO_REAUTH_CALLBACK_PATH,
  ACCOUNT_DELETION_SSO_REAUTH_ERROR_QUERY_PARAM,
  ACCOUNT_DELETION_SSO_REAUTH_FAILED_ERROR_CODE,
  ACCOUNT_DELETION_SSO_REAUTH_REQUIRED_ERROR_CODE,
} from "@/modules/account/constants";
import { requiresPasswordConfirmationForAccountDeletion } from "@/modules/account/lib/account-deletion-auth";
import {
  getSsoProviderLookupCandidates,
  normalizeSsoProvider,
} from "@/modules/ee/sso/lib/provider-normalization";

const ACCOUNT_DELETION_SSO_REAUTH_INTENT_TTL_MS = 10 * 60 * 1000;
const ACCOUNT_DELETION_SSO_REAUTH_MARKER_TTL_MS = 5 * 60 * 1000;
const SSO_AUTH_TIME_MAX_AGE_SECONDS = 5 * 60;
const SSO_AUTH_TIME_FUTURE_SKEW_SECONDS = 60;

type TSsoIdentityProvider = Exclude<IdentityProvider, "email">;
type TAccountWithSamlAuthnInstant = Account & {
  authn_instant?: unknown;
};

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

const OIDC_REAUTH_PROVIDERS = new Set<TSsoIdentityProvider>([
  "azuread",
  ...(GOOGLE_ACCOUNT_DELETION_REAUTH_ENABLED ? (["google"] as const) : []),
  "openid",
]);
// GitHub OAuth does not return a verifiable auth_time/max_age proof, so it cannot secure this
// destructive action without another app-controlled step-up.
const FRESH_SSO_REAUTH_PROVIDERS = new Set<TSsoIdentityProvider>([...OIDC_REAUTH_PROVIDERS, "saml"]);
// Google only returns auth_time when it is explicitly requested as an ID token claim.
const GOOGLE_AUTH_TIME_CLAIMS_REQUEST = JSON.stringify({
  id_token: {
    auth_time: {
      essential: true,
    },
  },
});

const getAccountDeletionSsoReauthIntentKey = (intentId: string) =>
  createCacheKey.custom("account_deletion", "sso_reauth_intent", intentId);

const getAccountDeletionSsoReauthMarkerKey = (userId: string) =>
  createCacheKey.custom("account_deletion", userId, "sso_reauth_complete");

const getSsoIdentityProviderOrThrow = (
  identityProvider: IdentityProvider,
  providerAccountId: string | null
): { provider: TSsoIdentityProvider; providerAccountId: string } => {
  if (identityProvider === "email" || !providerAccountId) {
    throw new AuthorizationError(ACCOUNT_DELETION_SSO_REAUTH_REQUIRED_ERROR_CODE);
  }

  return { provider: identityProvider, providerAccountId };
};

const assertSsoProviderSupportsFreshReauthentication = (provider: TSsoIdentityProvider) => {
  if (provider === "google" && !GOOGLE_ACCOUNT_DELETION_REAUTH_ENABLED) {
    logger.warn(
      { googleAccountDeletionReauthEnabled: GOOGLE_ACCOUNT_DELETION_REAUTH_ENABLED, provider },
      "Google SSO account deletion reauthentication is not enabled"
    );
    throw new AuthorizationError(ACCOUNT_DELETION_GOOGLE_REAUTH_NOT_CONFIGURED_ERROR_CODE);
  }

  if (!FRESH_SSO_REAUTH_PROVIDERS.has(provider)) {
    logger.warn(
      { googleAccountDeletionReauthEnabled: GOOGLE_ACCOUNT_DELETION_REAUTH_ENABLED, provider },
      "SSO provider does not support verifiable account deletion reauthentication"
    );
    throw new AuthorizationError(ACCOUNT_DELETION_SSO_REAUTH_REQUIRED_ERROR_CODE);
  }
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
    if (provider === "google") {
      return {
        claims: GOOGLE_AUTH_TIME_CLAIMS_REQUEST,
        login_hint: email,
        max_age: "0",
      };
    }

    return {
      login_hint: email,
      max_age: "0",
      prompt: "login",
    };
  }

  throw new AuthorizationError(ACCOUNT_DELETION_SSO_REAUTH_REQUIRED_ERROR_CODE);
};

const createAccountDeletionSsoReauthCallbackUrl = (intentToken: string) => {
  const callbackUrl = new URL(ACCOUNT_DELETION_SSO_REAUTH_CALLBACK_PATH, WEBAPP_URL);
  callbackUrl.searchParams.set("intent", intentToken);
  return callbackUrl.toString();
};

const getAccountDeletionSsoReauthErrorCode = (error: unknown) => {
  if (error instanceof Error && error.message === ACCOUNT_DELETION_GOOGLE_REAUTH_NOT_CONFIGURED_ERROR_CODE) {
    return ACCOUNT_DELETION_GOOGLE_REAUTH_NOT_CONFIGURED_ERROR_CODE;
  }

  return ACCOUNT_DELETION_SSO_REAUTH_FAILED_ERROR_CODE;
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

export const getAccountDeletionSsoReauthFailureRedirectUrl = ({
  error,
  intentToken,
}: {
  error: unknown;
  intentToken: string | null;
}): string | null => {
  if (!intentToken) {
    return null;
  }

  try {
    const intent = verifyAccountDeletionSsoReauthIntent(intentToken);
    const validatedReturnToUrl = getValidatedCallbackUrl(intent.returnToUrl, WEBAPP_URL);

    if (!validatedReturnToUrl) {
      return null;
    }

    const redirectUrl = new URL(validatedReturnToUrl);
    redirectUrl.searchParams.set(
      ACCOUNT_DELETION_SSO_REAUTH_ERROR_QUERY_PARAM,
      getAccountDeletionSsoReauthErrorCode(error)
    );
    return redirectUrl.toString();
  } catch (redirectError) {
    logger.error({ error: redirectError }, "Failed to resolve account deletion SSO reauth failure URL");
    return null;
  }
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

  if (!redis) {
    logger.error({ ...logContext, key }, "Redis is required to atomically consume SSO reauth cache value");
    throw new Error("Unable to consume account deletion SSO reauth value");
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
    cachedIntent?.userId !== intent.userId ||
    cachedIntent?.provider !== intent.provider ||
    cachedIntent?.providerAccountId !== intent.providerAccountId
  ) {
    throw new AuthorizationError(ACCOUNT_DELETION_SSO_REAUTH_REQUIRED_ERROR_CODE);
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

const assertFreshAuthTime = (authTimeInSeconds: number, logContext: Record<string, unknown>) => {
  const nowInSeconds = Math.floor(Date.now() / 1000);
  const isTooOld = nowInSeconds - authTimeInSeconds > SSO_AUTH_TIME_MAX_AGE_SECONDS;
  const isFromTheFuture = authTimeInSeconds - nowInSeconds > SSO_AUTH_TIME_FUTURE_SKEW_SECONDS;

  if (isTooOld || isFromTheFuture) {
    logger.warn(
      {
        ...logContext,
        ageSeconds: nowInSeconds - authTimeInSeconds,
        authTimeInSeconds,
        futureSkewSeconds: authTimeInSeconds - nowInSeconds,
        maxAgeSeconds: SSO_AUTH_TIME_MAX_AGE_SECONDS,
      },
      "SSO account deletion reauthentication timestamp is not fresh"
    );
    throw new AuthorizationError(ACCOUNT_DELETION_SSO_REAUTH_REQUIRED_ERROR_CODE);
  }
};

const assertFreshOidcAuthTime = (provider: TSsoIdentityProvider, idToken?: string) => {
  if (!OIDC_REAUTH_PROVIDERS.has(provider)) {
    return;
  }

  if (!idToken) {
    logger.warn({ provider }, "OIDC account deletion reauthentication callback is missing an ID token");
    throw new AuthorizationError(ACCOUNT_DELETION_SSO_REAUTH_REQUIRED_ERROR_CODE);
  }

  const decodedToken = jwt.decode(idToken);

  if (!decodedToken || typeof decodedToken === "string") {
    logger.warn({ provider }, "OIDC account deletion reauthentication callback has an invalid ID token");
    throw new AuthorizationError(ACCOUNT_DELETION_SSO_REAUTH_REQUIRED_ERROR_CODE);
  }

  const { auth_time: authTime } = decodedToken;

  if (typeof authTime !== "number") {
    logger.warn(
      { claimKeys: Object.keys(decodedToken), provider },
      "OIDC account deletion reauthentication callback is missing numeric auth_time"
    );
    if (provider === "google") {
      throw new AuthorizationError(ACCOUNT_DELETION_GOOGLE_REAUTH_NOT_CONFIGURED_ERROR_CODE);
    }

    throw new AuthorizationError(ACCOUNT_DELETION_SSO_REAUTH_REQUIRED_ERROR_CODE);
  }

  assertFreshAuthTime(authTime, { claim: "auth_time", provider });
};

const assertFreshSamlAuthnInstant = (
  provider: TSsoIdentityProvider,
  account: TAccountWithSamlAuthnInstant
) => {
  if (provider !== "saml") {
    return;
  }

  if (typeof account.authn_instant !== "string") {
    logger.warn({ provider }, "SAML account deletion reauthentication callback is missing AuthnInstant");
    throw new AuthorizationError(ACCOUNT_DELETION_SSO_REAUTH_REQUIRED_ERROR_CODE);
  }

  const authnInstantTimestamp = Date.parse(account.authn_instant);

  if (Number.isNaN(authnInstantTimestamp)) {
    logger.warn({ provider }, "SAML account deletion reauthentication callback has invalid AuthnInstant");
    throw new AuthorizationError(ACCOUNT_DELETION_SSO_REAUTH_REQUIRED_ERROR_CODE);
  }

  assertFreshAuthTime(Math.floor(authnInstantTimestamp / 1000), { claim: "authn_instant", provider });
};

const assertFreshSsoAuthentication = (provider: TSsoIdentityProvider, account: Account) => {
  assertSsoProviderSupportsFreshReauthentication(provider);
  assertFreshOidcAuthTime(provider, account.id_token);
  assertFreshSamlAuthnInstant(provider, account);
};

const getVerifiedAccountDeletionSsoReauthIntent = (intentToken: string) => {
  const intent = verifyAccountDeletionSsoReauthIntent(intentToken);
  const provider = normalizeSsoProvider(intent.provider);

  if (!provider || provider === "email") {
    throw new AuthorizationError(ACCOUNT_DELETION_SSO_REAUTH_REQUIRED_ERROR_CODE);
  }

  assertSsoProviderSupportsFreshReauthentication(provider);

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
    throw new AuthorizationError(ACCOUNT_DELETION_SSO_REAUTH_REQUIRED_ERROR_CODE);
  }

  return normalizedProvider;
};

const assertAccountMatchesIntent = ({
  account,
  expectedProvider,
  expectedProviderAccountId,
  provider,
}: {
  account: Account;
  expectedProvider: TSsoIdentityProvider;
  expectedProviderAccountId: string;
  provider: TSsoIdentityProvider;
}) => {
  if (provider !== expectedProvider || account.providerAccountId !== expectedProviderAccountId) {
    throw new AuthorizationError(ACCOUNT_DELETION_SSO_REAUTH_REQUIRED_ERROR_CODE);
  }
};

const validateAccountDeletionSsoReauthenticationCallbackContext = async ({
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
    expectedProvider: storedIntent.provider,
    expectedProviderAccountId: storedIntent.providerAccountId,
    provider: normalizedProvider,
  });
  assertFreshSsoAuthentication(normalizedProvider, account);
  await assertStoredAccountDeletionSsoReauthIntentExists(storedIntent);

  return { intent, normalizedProvider, storedIntent };
};

export const startAccountDeletionSsoReauthentication = async ({
  confirmationEmail,
  returnToUrl,
  userId,
}: TStartAccountDeletionSsoReauthenticationInput): Promise<TStartAccountDeletionSsoReauthenticationResult> => {
  const userAuthenticationData = await getUserAuthenticationData(userId);

  if (confirmationEmail.toLowerCase() !== userAuthenticationData.email.toLowerCase()) {
    throw new AuthorizationError(ACCOUNT_DELETION_EMAIL_MISMATCH_ERROR_CODE);
  }

  if (requiresPasswordConfirmationForAccountDeletion(userAuthenticationData)) {
    throw new InvalidInputError(ACCOUNT_DELETION_CONFIRMATION_REQUIRED_ERROR_CODE);
  }

  const { provider, providerAccountId } = getSsoIdentityProviderOrThrow(
    userAuthenticationData.identityProvider,
    userAuthenticationData.identityProviderAccountId
  );
  assertSsoProviderSupportsFreshReauthentication(provider);
  logger.info({ provider, userId }, "Starting account deletion SSO reauthentication");

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
  const { intent, normalizedProvider, storedIntent } =
    await validateAccountDeletionSsoReauthenticationCallbackContext({
      account,
      intentToken,
    });

  const linkedUserId = await findLinkedSsoUserId({
    provider: normalizedProvider,
    providerAccountId: account.providerAccountId,
  });

  if (linkedUserId !== intent.userId) {
    throw new AuthorizationError(ACCOUNT_DELETION_SSO_REAUTH_REQUIRED_ERROR_CODE);
  }

  await consumeStoredAccountDeletionSsoReauthIntent(storedIntent);

  await storeAccountDeletionSsoReauthMarker({
    completedAt: Date.now(),
    id: intent.id,
    provider: normalizedProvider,
    providerAccountId: account.providerAccountId,
    userId: intent.userId,
  });
  logger.info(
    { intentId: intent.id, provider: normalizedProvider, userId: intent.userId },
    "Completed account deletion SSO reauthentication"
  );
};

export const validateAccountDeletionSsoReauthenticationCallback = async ({
  account,
  intentToken,
}: {
  account: Account;
  intentToken: string;
}) => {
  await validateAccountDeletionSsoReauthenticationCallbackContext({
    account,
    intentToken,
  });
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
  assertSsoProviderSupportsFreshReauthentication(provider);

  const marker = await consumeCachedJsonValue<TAccountDeletionSsoReauthMarker>(
    getAccountDeletionSsoReauthMarkerKey(userId),
    { userId }
  );

  if (
    marker?.userId !== userId ||
    marker?.provider !== provider ||
    marker?.providerAccountId !== ssoProviderAccountId ||
    Date.now() - (marker?.completedAt ?? 0) > ACCOUNT_DELETION_SSO_REAUTH_MARKER_TTL_MS
  ) {
    throw new AuthorizationError(ACCOUNT_DELETION_SSO_REAUTH_REQUIRED_ERROR_CODE);
  }
};
