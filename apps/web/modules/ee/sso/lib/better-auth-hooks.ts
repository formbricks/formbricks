import "server-only";
import type { BetterAuthOptions } from "better-auth";
import { APIError, createAuthMiddleware, getOAuthState } from "better-auth/api";
import { prisma } from "@formbricks/database";
import { WEBAPP_URL } from "@/lib/constants";
import { findMatchingLocale } from "@/lib/utils/locale";
import { getIsSamlSsoEnabled, getIsSsoEnabled } from "@/modules/ee/license-check/lib/utils";
import { LINKED_SSO_LOOKUP_SELECT } from "./account-linking";
import { normalizeSsoProvider } from "./provider-normalization";
import { gateSsoProvisioning, provisionSsoUserMemberships } from "./sso-provisioning";
import { startSsoRecovery } from "./sso-recovery";
import {
  getPendingSsoIdentity,
  getSsoProvisioningDecision,
  setSsoProvisioningDecision,
} from "./sso-request-context";

/**
 * Resolve the SSO provider id from a Better Auth callback endpoint context, else null.
 *
 * Better Auth sets `context.path` to the ROUTE PATTERN — `/oauth2/callback/:providerId` for the
 * generic-OAuth plugin, `/callback/:id` for built-in social — and the matched provider on
 * `context.params` (`providerId` or `id`). We prefer the parsed param and fall back to parsing a
 * resolved path. Returns null for non-callback paths (e.g. `/sign-up/email`) so the hooks below
 * only act on SSO sign-ups.
 */
export const getSsoProviderFromContext = (
  context: { path?: string; params?: Record<string, string | undefined> } | null | undefined
): string | null => {
  const path = context?.path;
  if (!path || !path.includes("/callback")) return null;
  const fromParams = context?.params?.providerId ?? context?.params?.id;
  if (fromParams && !fromParams.startsWith(":")) return fromParams;
  const match = /\/callback\/([^/?:]+)$/.exec(path);
  return match ? match[1] : null;
};

/** Fallback display name derived from an email local-part (parity `provisionNewSsoUser`:372-377). */
const deriveNameFromEmail = (email: string): string =>
  email
    .split("@")[0]
    .replace(/[^'\p{L}\p{M}\s\d-]+/gu, " ")
    .trim();

/**
 * Better Auth `databaseHooks` re-expressing Formbricks' SSO sign-up flow (design doc §13), reusing
 * the existing logic via `./sso-provisioning`:
 *  - `user.create.before` — gate the SSO sign-up (`gateSsoProvisioning`; a reject returns `false`,
 *    which rolls back inside Better Auth's user+account transaction, so no orphan user is created);
 *    stash the resolved decision for the after-hook; and enrich the insert (email-verified — the IdP
 *    attests it; `identityProvider`; request-matched `locale`; email-localpart name fallback).
 *  - `user.create.after` — run the membership/team/notification provisioning (`provisionSsoUserMemberships`).
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
        if (!identityProvider) return; // not an SSO sign-up (e.g. email/password) → keep defaults

        // Provisioning gate — orphan-safe: a reject returns `false`, rolling back the user+account
        // insert inside Better Auth's transaction (a post-commit after-hook could not reject safely).
        let callbackUrl = "";
        try {
          callbackUrl = (await getOAuthState())?.callbackURL ?? "";
        } catch {
          // Non-OAuth context / state unavailable → treat as no callback URL.
        }
        const decision = await gateSsoProvisioning({ email: user.email, callbackUrl });
        if (decision.action === "reject") return false;
        setSsoProvisioningDecision(decision); // carried to user.create.after (the membership writes)

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
            ...(user.name ? {} : { name: deriveNameFromEmail(user.email) }),
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
          provider: identityProvider,
          organizationId: decision.organizationId,
          assignToDefaultTeam: decision.assignToDefaultTeam,
          signupSource: decision.signupSource,
        });
      },
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
 * `handleSsoCallback`'s runtime checks (sso-handlers.ts:492-523). Provider registration is gated by
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
