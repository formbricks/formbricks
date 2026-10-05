import { OIDC_DISPLAY_NAME } from "@/lib/constants";
import type { TSsoIdentityProvider } from "./provider-normalization";

/**
 * What the login page calls each provider ("Continue with Microsoft"), for copy that tells a user which
 * one to use. Exhaustive over `TSsoIdentityProvider`, so a new provider fails typecheck here rather than
 * reaching a user as its raw id. These are product names and stay untranslated, as on the buttons.
 */
const SSO_PROVIDER_DISPLAY_NAMES = {
  google: "Google",
  github: "GitHub",
  azuread: "Microsoft",
  openid: "OpenID",
  saml: "SAML SSO",
} as const satisfies Record<TSsoIdentityProvider, string>;

export const getSsoProviderDisplayName = (provider: TSsoIdentityProvider): string =>
  // An operator-named OIDC provider is shown under that name on the login button, so it must be here too.
  provider === "openid" && OIDC_DISPLAY_NAME ? OIDC_DISPLAY_NAME : SSO_PROVIDER_DISPLAY_NAMES[provider];
