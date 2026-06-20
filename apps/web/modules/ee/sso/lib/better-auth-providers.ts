import "server-only";
import type { BetterAuthOptions } from "better-auth";
import type { GenericOAuthConfig } from "better-auth/plugins";
import {
  AZUREAD_CLIENT_ID,
  AZUREAD_CLIENT_SECRET,
  AZUREAD_TENANT_ID,
  AZURE_OAUTH_ENABLED,
  ENTERPRISE_LICENSE_KEY,
  GITHUB_ID,
  GITHUB_OAUTH_ENABLED,
  GITHUB_SECRET,
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  GOOGLE_OAUTH_ENABLED,
  OIDC_CLIENT_ID,
  OIDC_CLIENT_SECRET,
  OIDC_ISSUER,
  OIDC_OAUTH_ENABLED,
  SAML_OAUTH_ENABLED,
  SAML_PRODUCT,
  SAML_TENANT,
  WEBAPP_URL,
} from "@/lib/constants";
import { captureSsoIdentity } from "./sso-request-context";

// Better Auth's per-provider profile types, extracted so the social mappers below aren't implicitly
// `any` (their generic-OAuth siblings get this from `satisfies GenericOAuthConfig`).
type SocialProviders = NonNullable<BetterAuthOptions["socialProviders"]>;
// Each provider is `Config | (() => Awaitable<Config>)`; pull the config object out of that union.
type SocialConfig<K extends keyof SocialProviders> = Extract<
  NonNullable<SocialProviders[K]>,
  { mapProfileToUser?: unknown }
>;
type GithubProfile = Parameters<NonNullable<SocialConfig<"github">["mapProfileToUser"]>>[0];
type GoogleProfile = Parameters<NonNullable<SocialConfig<"google">["mapProfileToUser"]>>[0];

/**
 * Better Auth SSO providers (ENG-1054), mirroring the NextAuth set in `./providers.ts`. Gated behind
 * `ENTERPRISE_LICENSE_KEY` (parity with the `getSSOProviders()` gate) and each provider's configured
 * credentials. Google/GitHub use Better Auth's built-in social providers; Azure/OIDC/SAML use the
 * generic-OAuth plugin (Azure keeps providerId "azuread" so existing `account.provider` rows need no
 * remap — design doc D6).
 *
 * IMPORTANT — these objects only REGISTER providers. The hardened account linking / verify-before-link
 * (SSO recovery) + org-provisioning flow (design doc D7) is re-expressed via Better Auth hooks
 * SEPARATELY (not here); `account.accountLinking.enabled` is false so nothing auto-links. That hooks
 * work is the security-sensitive part of Phase 5 and is pending review.
 *
 * ⚠ The generic-OAuth callback path is `/api/auth/oauth2/callback/{providerId}` (differs from
 * NextAuth's `/api/auth/callback/{provider}`) — at cutover, the OIDC IdP redirect URIs and the BoxyHQ
 * Jackson connection `redirect_uri` must be re-registered to match.
 */
export const ssoSocialProviders = ENTERPRISE_LICENSE_KEY
  ? {
      ...(GITHUB_OAUTH_ENABLED
        ? {
            github: {
              clientId: GITHUB_ID ?? "",
              clientSecret: GITHUB_SECRET ?? "",
              // Capture the resolved identity for verify-before-link recovery (design doc §13).
              // ⚠ providerAccountId must equal Better Auth's account.accountId — validate at cutover.
              mapProfileToUser: (profile: GithubProfile) => {
                captureSsoIdentity({ email: profile.email, providerAccountId: String(profile.id) });
                return { email: profile.email };
              },
            },
          }
        : {}),
      ...(GOOGLE_OAUTH_ENABLED
        ? {
            google: {
              clientId: GOOGLE_CLIENT_ID ?? "",
              clientSecret: GOOGLE_CLIENT_SECRET ?? "",
              mapProfileToUser: (profile: GoogleProfile) => {
                captureSsoIdentity({ email: profile.email, providerAccountId: profile.sub });
                return { email: profile.email };
              },
            },
          }
        : {}),
    }
  : {};

export const ssoGenericOAuthConfig: GenericOAuthConfig[] = ENTERPRISE_LICENSE_KEY
  ? [
      ...(AZURE_OAUTH_ENABLED
        ? [
            {
              providerId: "azuread",
              clientId: AZUREAD_CLIENT_ID ?? "",
              clientSecret: AZUREAD_CLIENT_SECRET ?? "",
              discoveryUrl: `https://login.microsoftonline.com/${AZUREAD_TENANT_ID || "common"}/v2.0/.well-known/openid-configuration`,
              scopes: ["openid", "email", "profile"],
              pkce: true,
              mapProfileToUser: (profile) => {
                // Capture for verify-before-link recovery; name parity with the OIDC mapping.
                captureSsoIdentity({ email: profile.email, providerAccountId: profile.sub });
                return {
                  email: profile.email,
                  name:
                    profile.name ||
                    [profile.given_name, profile.family_name].filter(Boolean).join(" ") ||
                    profile.preferred_username,
                };
              },
            } satisfies GenericOAuthConfig,
          ]
        : []),
      ...(OIDC_OAUTH_ENABLED
        ? [
            {
              providerId: "openid",
              clientId: OIDC_CLIENT_ID ?? "",
              clientSecret: OIDC_CLIENT_SECRET ?? "",
              discoveryUrl: `${OIDC_ISSUER}/.well-known/openid-configuration`,
              scopes: ["openid", "email", "profile"],
              pkce: true,
              requireIssuerValidation: true, // RFC 9207 mix-up defense (design doc §10.3)
              mapProfileToUser: (profile) => {
                captureSsoIdentity({ email: profile.email, providerAccountId: profile.sub });
                return {
                  email: profile.email,
                  // Parity with provisionNewSsoUser (OIDC): name → given+family → preferred_username.
                  name:
                    profile.name ||
                    [profile.given_name, profile.family_name].filter(Boolean).join(" ") ||
                    profile.preferred_username,
                };
              },
            } satisfies GenericOAuthConfig,
          ]
        : []),
      ...(SAML_OAUTH_ENABLED
        ? [
            {
              // BoxyHQ SAML bridge — points at the existing local Jackson endpoints (unchanged).
              providerId: "saml",
              clientId: "dummy",
              clientSecret: "dummy",
              authorizationUrl: `${WEBAPP_URL}/api/auth/saml/authorize`,
              tokenUrl: `${WEBAPP_URL}/api/auth/saml/token`,
              userInfoUrl: `${WEBAPP_URL}/api/auth/saml/userinfo`,
              scopes: [],
              pkce: true,
              authorizationUrlParams: { provider: "saml", tenant: SAML_TENANT, product: SAML_PRODUCT },
              mapProfileToUser: (profile) => {
                // ⚠ BoxyHQ's userinfo id — validate it matches Better Auth's account.accountId at cutover.
                captureSsoIdentity({ email: profile.email, providerAccountId: String(profile.id) });
                return {
                  email: profile.email,
                  // Parity with provisionNewSsoUser (SAML): name → firstName + lastName.
                  name: profile.name || [profile.firstName, profile.lastName].filter(Boolean).join(" "),
                };
              },
            } satisfies GenericOAuthConfig,
          ]
        : []),
    ]
  : [];
