import "server-only";
import {
  AZURE_OAUTH_ENABLED,
  GITHUB_OAUTH_ENABLED,
  GOOGLE_OAUTH_ENABLED,
  OIDC_OAUTH_ENABLED,
  SAML_OAUTH_ENABLED,
} from "@/lib/constants";
import { getIsSamlSsoEnabled, getIsSsoEnabled } from "@/modules/ee/license-check/lib/utils";
import type { TSsoIdentityProvider } from "./provider-normalization";

/**
 * The SSO providers whose button the login page renders right now: configured on this instance AND
 * licensed. Same gates as `modules/auth/login/page.tsx` + `SSOOptions` — the whole block hides without
 * the `sso` feature, and SAML additionally needs `saml`. Keep the two in step: copy that points a user at
 * a provider is wrong the moment the login page stops offering it.
 */
export const getAvailableSsoProviders = async (): Promise<ReadonlySet<TSsoIdentityProvider>> => {
  const [isSsoEnabled, isSamlSsoEnabled] = await Promise.all([getIsSsoEnabled(), getIsSamlSsoEnabled()]);
  if (!isSsoEnabled) {
    return new Set();
  }

  const enabled: Record<TSsoIdentityProvider, boolean> = {
    google: GOOGLE_OAUTH_ENABLED,
    github: GITHUB_OAUTH_ENABLED,
    azuread: AZURE_OAUTH_ENABLED,
    openid: OIDC_OAUTH_ENABLED,
    saml: isSamlSsoEnabled && SAML_OAUTH_ENABLED,
  };
  return new Set((Object.keys(enabled) as TSsoIdentityProvider[]).filter((provider) => enabled[provider]));
};
