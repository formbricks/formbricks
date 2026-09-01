import "server-only";
import type { BetterAuthOptions } from "better-auth";
import { APIError, createAuthMiddleware, getOAuthState } from "better-auth/api";
import { cookies } from "next/headers";
import { prisma } from "@formbricks/database";
import { SIGNUP_EMAIL_DOMAIN_BLOCKED_ERROR_CODE } from "@formbricks/types/errors";
import { normalizeUserName } from "@formbricks/types/user";
import { WEBAPP_URL } from "@/lib/constants";
import { identifyPostHogPerson } from "@/lib/posthog";
import { findMatchingLocale } from "@/lib/utils/locale";
import { getAttributionPropertiesFromCookies } from "@/modules/auth/lib/attribution";
import { isSignupEmailDomainBlocked } from "@/modules/auth/lib/signup-email-domain";
import { isUninvitedSignupAllowed, signupDisabledError } from "@/modules/auth/lib/signup-policy";
import { isSignupDomainAllowed } from "@/modules/auth/lib/signup-request-context";
import { getIsSamlSsoEnabled, getIsSsoEnabled } from "@/modules/ee/license-check/lib/utils";
import { LINKED_SSO_LOOKUP_SELECT } from "./account-linking";
import { normalizeSsoProvider } from "./provider-normalization";
import { gateSsoProvisioning, provisionSsoUserMemberships } from "./sso-provisioning";
import { startSsoRecovery } from "./sso-recovery";
import {
  getPendingSsoIdentity,
  getSsoAttributionProperties,
  getSsoProvisioningDecision,
  getSsoSignupRejectReason,
  setSsoAttributionProperties,
  setSsoProvisioningDecision,
  setSsoSignupRejectReason,
} from "./sso-request-context";

/**
 * Resolve the SSO provider id from a Better Auth callback endpoint context, else null.
 *
 * Better Auth sets `context.path` to the ROUTE PATTERN — `/callback/:id` for both built-in social
 * providers and, since Better Auth 1.7 (ENG-2343), the `genericOAuth` plugin too (it now shares the
 * social-provider route instead of its own `/oauth2/callback/:providerId`) — and the matched provider
 * on `context.params` (`providerId` or `id`). We prefer the parsed param and fall back to parsing a
 * resolved path. Returns null for non-callback paths (e.g. `/sign-up/email`) so the hooks below
 * only act on SSO sign-ups.
 */
export const getSsoProviderFromContext = (
  context: { path?: string; params?: Record<string, string | undefined> } | null | undefined
): string | null => {
  const path = context?.path;
  if (!path?.includes("/callback")) return null;
  const fromParams = context?.params?.providerId ?? context?.params?.id;
  if (fromParams && !fromParams.startsWith(":")) return fromParams;
  const match = /\/callback\/([^/?:]+)$/.exec(path);
  return match ? match[1] : null;
};

/**
 * Fallback display name when the IdP supplies no name: humanize the email local-part (treat `. _ +` as
 * word separators) and run it through the shared normalizer. The name allowlist lives only in
 * normalizeUserName (tied to ZUserName), so there is no second name regex here that could drift.
 */
const deriveNameFromEmail = (email: string): string =>
  normalizeUserName(email.split("@")[0].replace(/[._+]+/g, " "));

/**
 * Narrow Better Auth's per-sign-in profile override down to the display name.
 *
 * With `AUTH_SSO_SYNC_NAME=1` the SSO providers set `overrideUserInfo`, which makes
 * `handleOAuthUserInfo` re-write the user row on every sign-in so a directory rename reaches
 * Formbricks. It writes the whole profile in one call — `{ name, image, email, emailVerified }` —
 * and two of those are wrong here:
 *
 *  - **`image`** would break sign-in outright. `User` has no `image` column (parity with
 *    `provisionNewSsoUser`, which never stored one), so the Prisma update throws. `user.create.before`
 *    already strips it on the sign-up path; this is the same strip on the sign-in path.
 *  - **`email`** is the account identity. Rewriting it from a provider claim would bypass the
 *    email-change verification flow, and a claim that collides with another row's unique email would
 *    fail the update mid-sign-in. A changed work address stays a deliberate, verified action.
 *
 * What is left — the name — is normalized exactly as on sign-up, so ENG-1743 can't come back through
 * the update path: an IdP name is untrusted input either way, and a raw one would persist here and
 * break the user's next profile save.
 *
 * Runs for SSO callbacks only, and only for the override write. Every other user update reaches the
 * adapter untouched: a `POST /change-email`, the `emailVerified` flip on the link path, and the
 * `identityProvider` denormalization in `account.create.after` (which is itself an `updateUser` on
 * the callback request, and is distinguished by carrying neither `name` nor `image`).
 */
export const ssoProfileSyncUpdateBefore = async (
  user: Record<string, unknown>,
  context?: { path?: string; params?: Record<string, string | undefined> } | null
): Promise<{ data: Record<string, unknown> } | void> => {
  const provider = getSsoProviderFromContext(context);
  if (!provider || !normalizeSsoProvider(provider)) return; // not an SSO callback

  // `handleOAuthUserInfo` destructures `name` and `image` out of the resolved userInfo, so both keys
  // are present on the override write and absent from every other update made on this request.
  if (!("name" in user) && !("image" in user)) return;

  // An `undefined` value drops the field from the update: on `action: "update"` the adapter's
  // transformInput skips every undefined field that has no `onUpdate`, which is all four of these.
  const normalizedName = typeof user.name === "string" ? normalizeUserName(user.name) : "";
  return {
    data: {
      image: undefined,
      email: undefined,
      emailVerified: undefined,
      // Unlike sign-up there is already a good name in the row, so a name that normalizes away
      // (emoji-only, punctuation-only) leaves it alone rather than falling back to the email
      // local-part — that would be a downgrade, and it would repeat on every sign-in.
      name: normalizedName || undefined,
    },
  };
};

/**
 * Better Auth `databaseHooks` re-expressing Formbricks' SSO sign-up flow (design doc §13), reusing
 * the existing logic via `./sso-provisioning`:
 *  - `user.create.before` — gate the SSO sign-up (`gateSsoProvisioning`; a reject returns `false`,
 *    which rolls back inside Better Auth's user+account transaction, so no orphan user is created);
 *    stash the resolved decision for the after-hook; and enrich the insert (email-verified — the IdP
 *    attests it; `identityProvider`; request-matched `locale`; email-localpart name fallback).
 *  - `user.create.after` — run the membership/team/notification provisioning (`provisionSsoUserMemberships`).
 *  - `user.update.before` — narrow the per-sign-in profile override to the display name
 *    (`ssoProfileSyncUpdateBefore`); only reached when `AUTH_SSO_SYNC_NAME=1` makes that write happen.
 *  - `account.create.after` — denormalize `identityProvider` + `identityProviderAccountId` onto
 *    `User` for legacy SSO lookups (`findLegacyExactMatch`), parity with `syncSsoIdentityForUser`.
 *
 * These hooks are LIVE: the `[...all]` route is mounted (its handler wraps `auth.handler` in
 * `runWithSsoRequestContext` for the before→after carry) and `emailVerified` is a boolean column. The
 * per-callback license re-check is `ssoLicenseGateBefore`, below; the verify-before-link recovery flow
 * is wired via `ssoRecoveryAfter` + the `/sso-recovery/sign-in` plugin.
 */
export const ssoDatabaseHooks: NonNullable<BetterAuthOptions["databaseHooks"]> = {
  user: {
    create: {
      before: async (user, context) => {
        const provider = getSsoProviderFromContext(context);
        const identityProvider = provider ? normalizeSsoProvider(provider) : null;
        if (!identityProvider) {
          // Credential sign-up. createUserAction runs the full personal-email policy (Cloud gate +
          // invite exemption) and marks the request scope before calling signUpEmail. If that mark is
          // absent, this is a direct POST to Better Auth's native /sign-up/email — which bypasses the
          // action — so re-enforce the domain block here (no invite is carried on that raw path).
          // One read, two guards: both re-checks below exist only for a request that skipped the action.
          const wentThroughAction = isSignupDomainAllowed();
          if (!wentThroughAction && (await isSignupEmailDomainBlocked(user.email, async () => false))) {
            return false;
          }
          // ENG-2293 BACKSTOP: closed-instance policy (SIGNUP_ENABLED / multi-org / fresh-instance).
          // The primary gate is `signupPolicyBeforeHandler` in auth.ts's `hooks.before`, which rejects
          // `POST /sign-up/email` before Better Auth looks the address up — deliberately NOT here,
          // because this hook only ever runs for an address that does not yet exist (the duplicate
          // branch returns a synthetic 200 without creating anything), so rejecting here and nowhere
          // else would answer "does this address have an account?". See signup-policy.ts.
          //
          // Kept anyway because this hook covers EVERY credential user-creation path, not just the one
          // route the before-hook names: any future Better Auth plugin that creates a user (magic link,
          // email OTP, admin create) lands here, and on a closed instance it should not.
          if (!wentThroughAction && !(await isUninvitedSignupAllowed())) {
            throw signupDisabledError();
          }
          return; // otherwise keep credential-signup defaults
        }

        // Provisioning gate — orphan-safe: a reject returns `false`, rolling back the user+account
        // insert inside Better Auth's transaction (a post-commit after-hook could not reject safely).
        let callbackUrl = "";
        try {
          callbackUrl = (await getOAuthState())?.callbackURL ?? "";
        } catch {
          // Non-OAuth context / state unavailable → treat as no callback URL.
        }
        const decision = await gateSsoProvisioning({ email: user.email, callbackUrl });
        if (decision.action === "reject") {
          // Stash the reason (request scope) so the after-hook can turn Better Auth's generic
          // create-failure redirect into a tailored one — e.g. the personal-email block redirects to
          // /auth/signup with a toast. Returning false rolls back the user+account insert.
          setSsoSignupRejectReason(decision.reason);
          return false;
        }
        setSsoProvisioningDecision(decision); // carried to user.create.after (the membership writes)

        // Read the marketing attribution cookie here, in request scope, and carry it to the
        // after-hook (which runs post-commit, where re-reading the cookie is unreliable). The
        // `user_signed_in` path clears the cookie via finalizeSuccessfulSignIn on the same request.
        try {
          setSsoAttributionProperties(getAttributionPropertiesFromCookies(await cookies()));
        } catch {
          // Best-effort: attribution is non-critical and must never block sign-up.
        }

        // Enrich the row in a single INSERT (shallow-merged): IdP-attested email, denormalized
        // provider, request-matched locale, and an email-localpart name when the IdP gave none.
        return {
          data: {
            emailVerified: true,
            identityProvider,
            locale: await findMatchingLocale(),
            // `User` has no `image` column (parity with provisionNewSsoUser, which never stored it).
            // Strip Better Auth's default image mapping (Google picture / GitHub avatar / OIDC
            // picture): transformInput drops undefined fields that have no schema default, so this
            // prevents a prisma.user.create validation error on SSO sign-up.
            image: undefined,
            // Normalize the IdP-supplied display name to a form ZUserName accepts (ENG-1743): external
            // provider names are untrusted and may carry punctuation ("J. Smith", "Smith & Co") that
            // would otherwise persist raw and later break a profile save. Fall back to the email
            // local-part, then to a constant, so the stored name is always a valid, non-empty
            // ZUserName — even for degenerate input (emoji-only name + symbol-only email local-part),
            // which would otherwise re-trigger the ENG-1743 error on the user's first profile save.
            name: (user.name && normalizeUserName(user.name)) || deriveNameFromEmail(user.email) || "User",
          },
        };
      },
      after: async (user, context) => {
        const decision = getSsoProvisioningDecision();
        if (!decision) return; // not a gated SSO sign-up
        const provider = getSsoProviderFromContext(context);
        const identityProvider = provider ? normalizeSsoProvider(provider) : null;
        if (!identityProvider) return;
        await provisionSsoUserMemberships({
          userId: user.id,
          email: user.email,
          name: user.name,
          provider: identityProvider,
          organizationId: decision.organizationId,
          assignToDefaultTeam: decision.assignToDefaultTeam,
          signupSource: decision.signupSource,
          attributionProperties: getSsoAttributionProperties(),
        });

        // Mark the new SSO user as identified in PostHog (parity with the credentials sign-up
        // path). provisionSsoUserMemberships only emits a bare `user_signed_up` capture, which
        // keeps the person unidentified; this fires `$identify` so `is_identified` flips.
        identifyPostHogPerson(user.id, { email: user.email, name: user.name });
      },
    },
    update: {
      before: ssoProfileSyncUpdateBefore,
    },
  },
  account: {
    create: {
      after: async (account, context) => {
        if (!context || account.providerId === "credential") return; // email/password, not SSO
        const identityProvider = normalizeSsoProvider(account.providerId);
        if (!identityProvider) return;
        // The provider account id isn't available in user.create.before (the account row is created
        // separately), so denormalize both columns here, once the account exists.
        await context.context.internalAdapter.updateUser(account.userId, {
          identityProvider,
          identityProviderAccountId: account.accountId,
        });
      },
    },
  },
};

/**
 * Request hook (`hooks.before`) that re-checks the SSO license on every SSO callback — parity with
 * the legacy NextAuth SSO callback's runtime license checks. Provider registration is gated by
 * `ENTERPRISE_LICENSE_KEY` (broad); this verifies the specific `sso`/`saml` feature flags on every
 * callback. It runs for ALL SSO sign-ins (including existing users, who skip `user.create` and so
 * aren't seen by the databaseHooks gate) and catches a license that changes at runtime. Blocks with
 * 403 when disabled.
 *
 * NOTE (cutover): on a browser callback this surfaces as a 403; redirecting to the auth error page
 * (matching NextAuth's behavior) is a Phase 7 refinement.
 */
export const ssoLicenseGateBeforeHandler = async (ctx: AuthHookContext): Promise<void> => {
  const provider = getSsoProviderFromContext(ctx);
  const identityProvider = provider ? normalizeSsoProvider(provider) : null;
  if (!identityProvider) return; // not an SSO callback → no license gate

  if (!(await getIsSsoEnabled())) {
    throw new APIError("FORBIDDEN", { message: "SSO is not enabled for this instance." });
  }
  if (identityProvider === "saml" && !(await getIsSamlSsoEnabled())) {
    throw new APIError("FORBIDDEN", { message: "SAML SSO is not enabled for this instance." });
  }
};

export const ssoLicenseGateBefore = createAuthMiddleware(ssoLicenseGateBeforeHandler);

/**
 * Request hook (`hooks.after`) that turns Better Auth's "account not linked" collision into
 * Formbricks' verify-before-link SSO recovery (design doc §13). With `accountLinking.enabled:false`,
 * an SSO sign-in whose email matches an existing account redirects to `?error=account_not_linked`.
 * We detect that on the callback, read the SSO identity captured in `mapProfileToUser`, and — if the
 * email maps to an existing user — start recovery (inbox-verification email + redirect to the
 * "check your email" page) instead of the generic error. Parity with handleSsoCallback's
 * email-match → startSsoRecovery branch. Live now that the `[...all]` route is mounted (its handler
 * wraps `auth.handler` in `runWithSsoRequestContext`).
 */
/** The endpoint context Better Auth passes to a `hooks.before`/`hooks.after` middleware handler. */
export type AuthHookContext = Parameters<Parameters<typeof createAuthMiddleware>[0]>[0];

/**
 * Plain-handler form of {@link ssoRecoveryAfter}. Exported so the composition root (auth.ts) can run
 * it alongside other after-hooks (e.g. the failed-auth audit) in Better Auth's single `hooks.after`
 * slot — passing the already-built context straight through, rather than calling the wrapped
 * middleware (which would re-run `createInternalContext` + the middleware `use` chain).
 */
export const ssoRecoveryAfterHandler = async (ctx: AuthHookContext): Promise<void> => {
  const providerId = getSsoProviderFromContext(ctx);
  const provider = providerId ? normalizeSsoProvider(providerId) : null;
  if (!provider) return; // not an SSO callback

  // Only act on Better Auth's account-collision redirect (handleOAuthUserInfo returns
  // "account not linked" → the callback redirects to <errorURL>?error=account_not_linked).
  const responseHeaders = (ctx.context as { responseHeaders?: { get(name: string): string | null } })
    .responseHeaders;
  if (!responseHeaders?.get("location")?.includes("error=account_not_linked")) return;

  const identity = getPendingSsoIdentity();
  if (!identity) return; // identity not captured → fall through to the default error redirect

  const existingUser = await prisma.user.findUnique({
    where: { email: identity.email },
    select: LINKED_SSO_LOOKUP_SELECT,
  });
  if (!existingUser) return; // no existing account → genuine error, leave the default redirect

  let callbackUrl = "";
  try {
    callbackUrl = ((await getOAuthState()) as { callbackURL?: string } | null)?.callbackURL ?? "";
  } catch {
    // No OAuth state available → recovery still works with an empty callback URL.
  }

  const recoveryPath = await startSsoRecovery({
    existingUser,
    provider,
    account: { provider, providerAccountId: identity.providerAccountId, type: "oauth" } as Parameters<
      typeof startSsoRecovery
    >[0]["account"],
    callbackUrl,
  });

  // Replace the ?error=account_not_linked redirect with the verify-before-link recovery flow.
  throw ctx.redirect(new URL(recoveryPath, WEBAPP_URL).toString());
};

export const ssoRecoveryAfter = createAuthMiddleware(ssoRecoveryAfterHandler);

/**
 * Request hook (`hooks.after`) that redirects a personal-email SSO sign-up rejection back to the
 * sign-up page. When `user.create.before` rejects the domain (returns `false`, rolling back the
 * insert), Better Auth finishes the OAuth callback with a generic error redirect (to /auth/login).
 * We detect our own reject reason — stashed in the same request scope — and rewrite that redirect to
 * `/auth/signup?error=<code>`; the sign-up form reads the param and toasts the localized message.
 *
 * Keyed on the stashed reason rather than Better Auth's error string (which is minified/version-
 * fragile), so it fires only for the domain block. Mutually exclusive with the account-not-linked
 * recovery above — that path matches an existing user and never reaches `user.create`. Composed last
 * in auth.ts's `hooks.after`, so the failed-auth audit still records the attempt before we redirect.
 */
export const blockedSignupDomainRedirectAfterHandler = async (ctx: AuthHookContext): Promise<void> => {
  if (getSsoSignupRejectReason() !== SIGNUP_EMAIL_DOMAIN_BLOCKED_ERROR_CODE) return;

  // The gate rejected the sign-up, so whatever redirect Better Auth set here is an error redirect —
  // replace it wholesale. If nothing set a location, there's nothing to rewrite.
  const responseHeaders = (ctx.context as { responseHeaders?: { get(name: string): string | null } })
    .responseHeaders;
  if (!responseHeaders?.get("location")) return;

  throw ctx.redirect(
    new URL(`/auth/signup?error=${SIGNUP_EMAIL_DOMAIN_BLOCKED_ERROR_CODE}`, WEBAPP_URL).toString()
  );
};

export const blockedSignupDomainRedirectAfter = createAuthMiddleware(blockedSignupDomainRedirectAfterHandler);
