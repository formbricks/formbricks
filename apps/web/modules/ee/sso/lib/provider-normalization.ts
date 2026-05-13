import type { IdentityProvider } from "@prisma/client";

const SSO_PROVIDER_MAP = {
  google: "google",
  github: "github",
  "azure-ad": "azuread",
  azuread: "azuread",
  openid: "openid",
  saml: "saml",
} as const satisfies Record<string, IdentityProvider>;

const LEGACY_SSO_PROVIDER_ALIASES: Partial<Record<IdentityProvider, string[]>> = {
  azuread: ["azure-ad"],
};

const isSupportedSsoProvider = (provider: string): provider is keyof typeof SSO_PROVIDER_MAP =>
  provider in SSO_PROVIDER_MAP;

export const normalizeSsoProvider = (provider: string): IdentityProvider | null => {
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
