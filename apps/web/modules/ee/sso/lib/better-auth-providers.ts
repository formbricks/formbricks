import "server-only";
import type { BetterAuthOptions } from "better-auth";
import type { GenericOAuthConfig, GenericOAuthUserInfo } from "better-auth/plugins";
import { logger } from "@formbricks/logger";
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
import { getAuthIssuerUrl } from "@/modules/auth/lib/oauth-urls";
import { ssoAccountIssuer } from "./constants";
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
 * credentials. Google/GitHub use Better Auth's built-in social providers; Azure/OIDC/SAML register
 * through the `genericOAuth` plugin (Azure keeps providerId "azuread" so existing `account.provider`
 * rows need no remap — design doc D6).
 *
 * IMPORTANT — these objects only REGISTER providers. The hardened account linking / verify-before-link
 * (SSO recovery) + org-provisioning flow (design doc D7) is re-expressed via Better Auth hooks
 * SEPARATELY (not here); `account.accountLinking.enabled` is false so nothing auto-links. That hooks
 * work is the security-sensitive part of Phase 5 and is pending review.
 *
 * ⚠ Callback path (ENG-2343): PINNED, and deliberately not the version default. Better Auth has moved
 * this path twice with no choice of ours — 1.6's `genericOAuth` plugin mounted its own
 * `/oauth2/callback/:providerId` route, and 1.7 rebuilt that plugin onto the built-in `/callback/:id`
 * one. Tracking the default makes every self-hoster re-register a redirect URI on each such upstream
 * change, so `redirectURI` below holds the v5.2 URL their IdPs already have. See ssoLegacyRedirectUri.
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

/**
 * The SSO callback URL every customer IdP has had registered since v5.2, pinned so it stops tracking
 * Better Auth's routing (ENG-2343).
 *
 * `redirectURI` wins over the route-derived value in both places that must agree — the authorization
 * request (`@better-auth/core/.../create-authorization-url.mjs`) and the token exchange
 * (`.../validate-authorization-code.mjs`), each `options.redirectURI || redirectURI` — so the IdP never
 * sees a `redirect_uri` mismatch between the two legs. The option is not new: 1.6 honoured it with the
 * same precedence, so pinning is not a 1.7 affordance we might lose on the next minor.
 *
 * Pinning the URL is only half the job, because `redirectURI` does NOT move the route Better Auth mounts
 * its handler on. `apps/web/app/api/auth/[...all]/route.ts` serves this legacy path by mapping it onto
 * the path the installed version actually handles — that half is ours and cannot be removed upstream.
 * This half rests on an upstream option, so better-auth-redirect-uri-pin.test.ts asserts the
 * `redirect_uri` Better Auth really emits and fails the build if it is ever ignored.
 *
 * Built off `getAuthIssuerUrl()` rather than `WEBAPP_URL`, deliberately: this URL is where the identity
 * provider delivers the authorization code, so it must name the same origin Better Auth itself considers
 * its base — `env.BETTER_AUTH_URL ?? env.NEXTAUTH_URL` (auth.ts), with WEBAPP_URL only as the last
 * fallback, which is exactly the precedence `getAuthIssuerUrl` encodes. Deriving it from WEBAPP_URL alone
 * would let the two diverge: the code would arrive at a host whose signed state cookie was never set, so
 * sign-in fails closed with a state mismatch. `appendPath` also handles the documented subpath shape where
 * the configured auth URL already ends in `/api/auth` (see ENG-606).
 */
const ssoLegacyRedirectUri = (providerId: string): string =>
  `${getAuthIssuerUrl()}/oauth2/callback/${providerId}`;

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

/**
 * Provider account subject, pinned per provider rather than left to Better Auth's default (ENG-2343).
 *
 * The default is `isOidc ? profile.sub ?? "" : profile.id ?? ""` (`generic-oauth/index.mjs:138`), and
 * `isOidc` is only ever set inside the discovery branch (`:103`). So it silently depends on whether
 * discovery ran: our Azure `common` path and the SAML bridge both configure endpoints explicitly, which
 * leaves `isOidc` false and resolves `profile.id` — correct for BoxyHQ, which returns `id`, and WRONG for
 * Microsoft Graph `/oidc/userinfo`, which returns only `sub`. That yields an empty subject and the
 * callback fails `OAUTH_ACCOUNT_SUBJECT_INVALID` → `error=unable_to_get_user_info`.
 *
 * Pinning it on all three makes identity derivation ours and independent of a discovery field, which
 * also stops the openid provider silently changing subject source across upgrades. An absent subject
 * still fails closed: Better Auth rejects an empty accountId rather than inventing one.
 */
const ssoAccountSubject =
  (field: "sub" | "id") =>
  ({ profile }: { profile: GenericOAuthUserInfo }): string | number =>
    profile[field] ?? "";

/**
 * Azure endpoint configuration, split on whether a concrete tenant is configured (ENG-2343).
 *
 * Better Auth 1.7 verifies the id_token whenever discovery yields both `jwks_uri` and `issuer`, and it
 * compares `iss` for **literal** equality. Microsoft's multi-tenant (`common`) discovery document
 * advertises `issuer: "https://login.microsoftonline.com/{tenantid}/v2.0"` — a documented TEMPLATE, not
 * a value. Microsoft's own guidance is to substitute the token's `tid` and validate that against the
 * tenants you accept; a literal comparison is guaranteed to fail, because every real id_token carries
 * the tenant GUID. So with `AZUREAD_TENANT_ID` unset (our documented default) 1.7 would reject every
 * Azure sign-in. 1.6 never had this problem: its genericOAuth read identity from UserInfo and never
 * parsed the id_token at all.
 *
 * Rather than make `AZUREAD_TENANT_ID` mandatory — which would demand action from every self-hoster who
 * has not set it, and drop support for genuinely multi-tenant app registrations, which have no single
 * issuer by construction — the tenant decides the mechanism:
 *
 * - **A tenant whose discovery document carries a real issuer** — a directory GUID, a verified domain
 *   like `contoso.onmicrosoft.com`, **or `consumers`** (see the table below): keep `discoveryUrl`. The
 *   discovered issuer is a real value, so the id_token is fully verified. Strictly stronger than 1.6.
 * - **Unset, or a template-issuer authority (`common` / `organizations`, ENG-2750)**: configure the
 *   endpoints explicitly and skip discovery, so no `idTokenConfig` is built
 *   (`generic-oauth/index.mjs` only constructs it inside the discovery branch) and identity comes from
 *   UserInfo — the 1.6 behaviour, over a client-authenticated back-channel call to Microsoft. Note this
 *   is not where the code flow's security lives: that is `state` + PKCE and the authenticated code
 *   exchange, and RFC 9207 mix-up defence still applies via `iss` on the authorization response when a
 *   provider sends one.
 *
 * Which of Microsoft's three multi-tenant authorities can be verified is NOT uniform, and guessing it
 * wrong costs either an outage or a silently weakened check. Read live from each
 * `/{authority}/v2.0/.well-known/openid-configuration`:
 *
 * | authority | advertised `issuer` | verifiable? |
 * | --- | --- | --- |
 * | `common` | `https://login.microsoftonline.com/{tenantid}/v2.0` | no — placeholder |
 * | `organizations` | `https://login.microsoftonline.com/{tenantid}/v2.0` | no — placeholder |
 * | `consumers` | `https://login.microsoftonline.com/9188040d-6c67-4c5b-b112-36a304b66dad/v2.0` | **yes** |
 *
 * `consumers` is the odd one out: personal Microsoft accounts all live in that one well-known MSA tenant,
 * so its discovery document names a real issuer and every id_token it mints matches. It therefore stays
 * on the discovery branch and keeps full verification — moving it here would drop a check that works.
 *
 * `common` and `organizations` must not take the discovery branch: Microsoft's guidance is to substitute
 * the token's `tid` into that placeholder, which a literal `iss` comparison can never satisfy, so every
 * sign-in fails verification and lands on `?error=unable_to_get_user_info`. That is exactly how ENG-2750
 * took Microsoft SSO down on Cloud — prod had `AZUREAD_TENANT_ID=common`, harmless on 1.6, a full outage
 * on 1.7. The authority is still kept in the endpoint URLs, because `organizations` meaningfully
 * restricts which account types Microsoft accepts at the authorize endpoint.
 *
 * Deliberately NOT setting `requireIdTokenVerification`: on the multi-tenant path it would throw at init
 * and take Azure sign-in down, which is the outcome this split exists to avoid.
 */
const AZURE_TEMPLATE_ISSUER_TENANTS = new Set(["common", "organizations"]);

const MICROSOFT_GRAPH_USERINFO_URL = "https://graph.microsoft.com/oidc/userinfo";

/**
 * Resolve the signed-in identity from Microsoft Graph, always (raised in review on #9017).
 *
 * Setting `userInfoUrl` is NOT enough to guarantee Graph is called. Better Auth's default
 * `fetchUserInfo` opens with an unverified shortcut
 * (`better-auth/dist/plugins/generic-oauth/index.mjs`):
 *
 * ```js
 * if (tokens.idToken) try {
 *   const decoded = decodeJwt(tokens.idToken);          // decode, NOT verify
 *   if (decoded?.sub && decoded?.email) return { id: decoded.sub, ...decoded };
 * } catch {}
 * if (!userInfoUrl) return null;                        // only reached when the shortcut misses
 * ```
 *
 * On the explicit-endpoint branch no `idToken` config exists — that is the whole point of skipping
 * discovery — so the verification step in `getUserInfo` is a no-op and nothing checks that token's
 * signature, issuer or nonce. We request the `email` scope, so a real Microsoft id_token carries both
 * `sub` and `email` and takes the shortcut every time. Identity would come from an unverified JWT
 * while the comments, the startup warning and the docs all promised it came from Graph.
 *
 * `c.getUserInfo` takes precedence over `fetchUserInfo` in that same file, so supplying it is how the
 * promise is kept. The access token authenticates the call, and it reached us over the
 * client-authenticated token exchange.
 *
 * Fails CLOSED: a non-OK response, an unparseable body, or a missing `sub` returns null, which Better
 * Auth turns into a failed sign-in rather than a partially-trusted identity. `sub` specifically,
 * because `accountSubject` pins the account key to it — inventing a fallback is how the wrong account
 * gets linked.
 */
const microsoftGraphUserInfo = async (tokens: {
  accessToken?: string;
}): Promise<GenericOAuthUserInfo | null> => {
  if (!tokens.accessToken) return null;
  try {
    const response = await fetch(MICROSOFT_GRAPH_USERINFO_URL, {
      method: "GET",
      headers: { Authorization: `Bearer ${tokens.accessToken}` },
    });
    if (!response.ok) return null;
    const profile = (await response.json()) as GenericOAuthUserInfo;
    if (!profile?.sub) return null;
    return {
      ...profile,
      // Strictly `=== true`, not Better Auth's `?? false`: this flag is a claim from the provider that
      // feeds provisioning, so anything that is not an explicit boolean true is treated as unverified.
      emailVerified: profile.email_verified === true,
      image: typeof profile.picture === "string" ? profile.picture : undefined,
    };
  } catch {
    return null;
  }
};
// Unset behaves exactly like `common`: Microsoft's multi-tenant authority, and the documented default.
const azureTenant = AZUREAD_TENANT_ID?.trim() || "common";
const isAzureTemplateIssuerTenant = AZURE_TEMPLATE_ISSUER_TENANTS.has(azureTenant.toLowerCase());
// A template-issuer authority is one of two known literals, so emit its canonical lower-case form; a
// concrete tenant is passed through exactly as the operator configured it.
const azureAuthority = isAzureTemplateIssuerTenant ? azureTenant.toLowerCase() : azureTenant;
// Only worth saying when Azure SSO is actually registered — which needs BOTH gates below, mirroring
// `ssoGenericOAuthConfig`'s own conditions — and only when the operator set the value themselves, since
// an unset var takes this same path by design and needs no warning.
//
// The wording deliberately avoids "treating it like unset": an operator who set `organizations` would
// read that as having lost their work/school-only restriction, which still applies at the authorize
// endpoint. Only id_token verification is given up.
if (
  ENTERPRISE_LICENSE_KEY &&
  AZURE_OAUTH_ENABLED &&
  AZUREAD_TENANT_ID?.trim() &&
  isAzureTemplateIssuerTenant
) {
  logger.warn(
    `AZUREAD_TENANT_ID="${azureTenant}" names a Microsoft multi-tenant authority whose discovery document advertises a placeholder issuer, so id_tokens cannot be verified against it. Skipping discovery for this provider and taking identity from the userinfo endpoint; the authority you configured still applies at sign-in. Set a Directory (tenant) ID for full id_token verification.`
  );
}
const azureEndpoints = isAzureTemplateIssuerTenant
  ? {
      authorizationUrl: `https://login.microsoftonline.com/${azureAuthority}/oauth2/v2.0/authorize`,
      tokenUrl: `https://login.microsoftonline.com/${azureAuthority}/oauth2/v2.0/token`,
      userInfoUrl: MICROSOFT_GRAPH_USERINFO_URL,
      // Not redundant with `userInfoUrl` — see microsoftGraphUserInfo. The URL alone leaves Better
      // Auth's unverified-id_token shortcut in play; this is what actually forces the Graph call.
      getUserInfo: microsoftGraphUserInfo,
    }
  : {
      discoveryUrl: `https://login.microsoftonline.com/${azureAuthority}/v2.0/.well-known/openid-configuration`,
    };

export const ssoGenericOAuthConfig: GenericOAuthConfig[] = ENTERPRISE_LICENSE_KEY
  ? [
      ...(AZURE_OAUTH_ENABLED
        ? [
            {
              providerId: "azuread",
              clientId: AZUREAD_CLIENT_ID ?? "",
              clientSecret: AZUREAD_CLIENT_SECRET ?? "",
              ...azureEndpoints,
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
              accountSubject: ssoAccountSubject("sub"),
              redirectURI: ssoLegacyRedirectUri("azuread"),
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
              accountSubject: ssoAccountSubject("sub"),
              redirectURI: ssoLegacyRedirectUri("openid"),
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
              accountSubject: ssoAccountSubject("id"),
              redirectURI: ssoLegacyRedirectUri("saml"),
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
