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

export const normalizeSsoProvider = (provider: string): IdentityProvider | null => {
  const normalizedProvider = SSO_PROVIDER_MAP[provider.toLowerCase()];

  return normalizedProvider ?? null;
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
