import "server-only";
import type { BetterAuthOptions } from "better-auth";
import { APIError, createAuthMiddleware, getOAuthState } from "better-auth/api";
import { findMatchingLocale } from "@/lib/utils/locale";
import { getIsSamlSsoEnabled, getIsSsoEnabled } from "@/modules/ee/license-check/lib/utils";
import { normalizeSsoProvider } from "./provider-normalization";
import { gateSsoProvisioning, provisionSsoUserMemberships } from "./sso-provisioning";
import { getSsoProvisioningDecision, setSsoProvisioningDecision } from "./sso-request-context";

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
 * Nothing here runs until the Phase 7 cutover — the `[...all]` route is not mounted (its handler must
 * wrap `auth.handler` in `runWithSsoRequestContext` for the before→after carry), and `emailVerified`
 * stays a `DateTime` column until then. (The per-callback license re-check is `ssoLicenseGateBefore`,
 * below.) The verify-before-link recovery flow is the remaining Phase 5c work.
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
export const ssoLicenseGateBefore = createAuthMiddleware(async (ctx) => {
  const provider = getSsoProviderFromContext(ctx);
  const identityProvider = provider ? normalizeSsoProvider(provider) : null;
  if (!identityProvider) return; // not an SSO callback → no license gate

  if (!(await getIsSsoEnabled())) {
    throw new APIError("FORBIDDEN", { message: "SSO is not enabled for this instance." });
  }
  if (identityProvider === "saml" && !(await getIsSamlSsoEnabled())) {
    throw new APIError("FORBIDDEN", { message: "SAML SSO is not enabled for this instance." });
  }
});
