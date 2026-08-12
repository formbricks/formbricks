import "server-only";
import type { BetterAuthOptions } from "better-auth";
import type { GenericOAuthConfig, GenericOAuthUserInfo } from "better-auth/plugins";
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
                captureSsoIdentity({ email: profile.email, providerAccountId: toAccountSubject(profile.id) });
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

/**
 * The account-identity namespace for a generic-OAuth provider (ENG-2343).
 *
 * Better Auth 1.7 keys accounts on (issuer, accountId). Left to itself a provider with a
 * `discoveryUrl` adopts the DISCOVERED issuer, which is tenant-specific — different for every
 * self-hoster, and therefore impossible to reproduce in a portable backfill. Pinning the synthetic
 * form Better Auth itself uses for providers without their own issuer (`local:oauth:<id>`) keeps
 * identity scoped to the provider id, exactly as 1.6 keyed it, so existing accounts keep matching
 * after the upgrade and the migration backfill is one portable UPDATE.
 *
 * This value is load-bearing: it must stay byte-identical to what
 * migration/20260812110000_eng_2343_better_auth_17_resource_model writes into Account.issuer.
 */
/**
 * Coerce a provider subject to a string WITHOUT inventing one.
 *
 * Better Auth 1.7 types `sub`/`id` as `string | number`, so a bare `String(...)` is tempting — but it
 * turns a missing subject into the literal "undefined", which is truthy. `captureSsoIdentity`
 * deliberately drops an identity whose providerAccountId is falsy, precisely so a provider that omits
 * it cannot drive account recovery and link the wrong account. Passing "undefined" would sail past
 * that guard.
 */
const toAccountSubject = (subject: string | number | null | undefined): string | undefined =>
  subject === null || subject === undefined ? undefined : String(subject);

const ssoAccountIssuer = (providerId: string): string => `local:oauth:${encodeURIComponent(providerId)}`;

/** OIDC display name: `name`, else given+family, else `preferred_username`. */
const toDisplayName = (profile: GenericOAuthUserInfo): string | undefined => {
  const parts = [profile.given_name, profile.family_name].filter(Boolean).join(" ");
  const name = profile.name || parts || profile.preferred_username;
  return typeof name === "string" && name.length > 0 ? name : undefined;
};

/** BoxyHQ userinfo display name: `name`, else firstName + lastName. */
const toSamlDisplayName = (profile: GenericOAuthUserInfo): string | undefined => {
  const parts = [profile.firstName, profile.lastName].filter(Boolean).join(" ");
  const name = profile.name || parts;
  return typeof name === "string" && name.length > 0 ? name : undefined;
};

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
              // Redundant since 1.7 defaults it to true, kept explicit: this is a security control,
              // and an explicit value survives a future default flip.
              pkce: true,
              // `requireIssuerValidation` is gone in 1.7 (ENG-2343) and this no longer needs an
              // opt-out. ENG-1800 was that Better Auth rejected a MISSING RFC 9207 `iss` response
              // parameter, which Microsoft Entra never sends — so the check could only ever fail.
              // 1.7 only compares `iss` when the provider actually returns one
              // (`if (iss && provider.issuer && iss !== provider.issuer)`), so Entra short-circuits
              // and the mix-up defence still applies to providers that do implement RFC 9207.
              accountIssuer: ssoAccountIssuer("azuread"),
              mapProfileToUser: (profile) => {
                // Capture for verify-before-link recovery; name parity with the OIDC mapping.
                captureSsoIdentity({
                  email: profile.email,
                  providerAccountId: toAccountSubject(profile.sub),
                });
                return {
                  email: profile.email,
                  name: toDisplayName(profile),
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
              // Redundant since 1.7 defaults it to true, kept explicit (see azuread above).
              pkce: true,
              // `requireIssuerValidation: true` (RFC 9207 mix-up defence, design doc §10.3) is gone
              // in 1.7 — the comparison is now automatic whenever the provider returns `iss`, so the
              // defence is kept without the flag.
              accountIssuer: ssoAccountIssuer("openid"),
              mapProfileToUser: (profile) => {
                captureSsoIdentity({
                  email: profile.email,
                  providerAccountId: toAccountSubject(profile.sub),
                });
                return {
                  email: profile.email,
                  // Parity with provisionNewSsoUser (OIDC): name → given+family → preferred_username.
                  name: toDisplayName(profile),
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
              // Redundant since 1.7 defaults it to true, kept explicit (see azuread above).
              pkce: true,
              // Already a plain string map, which is all 1.7 accepts here.
              authorizationUrlParams: { provider: "saml", tenant: SAML_TENANT, product: SAML_PRODUCT },
              accountIssuer: ssoAccountIssuer("saml"),
              mapProfileToUser: (profile) => {
                // ⚠ BoxyHQ's userinfo id — validate it matches Better Auth's account.accountId at cutover.
                captureSsoIdentity({ email: profile.email, providerAccountId: toAccountSubject(profile.id) });
                return {
                  email: profile.email,
                  // Parity with provisionNewSsoUser (SAML): name → firstName + lastName.
                  name: toSamlDisplayName(profile),
                };
              },
            } satisfies GenericOAuthConfig,
          ]
        : []),
    ]
  : [];
