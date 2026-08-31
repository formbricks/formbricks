import type { IdentityProvider } from "@formbricks/database/prisma";

/**
 * The SSO subset of `IdentityProvider`: every value except `email`, which denotes a credential account
 * and can never come out of an SSO callback. Narrowing `normalizeSsoProvider` to this is what lets a
 * per-provider policy table (see `./email-verification-policy`) be exhaustive — adding a provider to
 * the Prisma enum then fails typecheck until the policy names it, rather than falling into a default.
 */
export type TSsoIdentityProvider = Exclude<IdentityProvider, "email">;

const SSO_PROVIDER_MAP = {
  google: "google",
  github: "github",
  "azure-ad": "azuread",
  azuread: "azuread",
  openid: "openid",
  saml: "saml",
} as const satisfies Record<string, TSsoIdentityProvider>;

const LEGACY_SSO_PROVIDER_ALIASES: Partial<Record<IdentityProvider, string[]>> = {
  azuread: ["azure-ad"],
};

const isSupportedSsoProvider = (provider: string): provider is keyof typeof SSO_PROVIDER_MAP =>
  provider in SSO_PROVIDER_MAP;

export const normalizeSsoProvider = (provider: string): TSsoIdentityProvider | null => {
  const normalizedProviderKey = provider.toLowerCase();
  if (!isSupportedSsoProvider(normalizedProviderKey)) {
    return null;
  }

  return SSO_PROVIDER_MAP[normalizedProviderKey];
};

export const getLegacySsoProviderAliases = (provider: IdentityProvider): string[] =>
  LEGACY_SSO_PROVIDER_ALIASES[provider] ?? [];

export const getSsoProviderLookupCandidates = (provider: string): string[] => {
  const normalizedProvider = normalizeSsoProvider(provider);

  if (!normalizedProvider) {
    return [];
  }

  return [normalizedProvider, ...getLegacySsoProviderAliases(normalizedProvider)];
};

/**
 * Resolves a NextAuth provider id (e.g. "azure-ad") to the canonical provider string persisted
 * in `Account.provider` (e.g. "azuread"). Unknown providers are returned unchanged so callers
 * never drop a value they were handed.
 */
export const resolveAccountProvider = (provider: string): string =>
  normalizeSsoProvider(provider) ?? provider;
