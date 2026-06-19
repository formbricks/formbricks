import "server-only";
import type { BetterAuthOptions } from "better-auth";
import { normalizeSsoProvider } from "./provider-normalization";

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

/**
 * Better Auth `databaseHooks` re-expressing Formbricks' SSO identity behavior (design doc §13):
 *  - mark SSO sign-ups email-verified at creation (the IdP attests the email) + denormalize
 *    `identityProvider` — parity with `provisionNewSsoUser`;
 *  - denormalize `identityProvider` + `identityProviderAccountId` onto `User` when an SSO `account`
 *    row is created — parity with `syncSsoIdentityForUser`, for legacy SSO lookups
 *    (`findLegacyExactMatch`).
 *
 * SCOPE: field-verification + identity denormalization only. JIT provisioning (org/team/invite/
 * license) and verify-before-link recovery are a separate, security-reviewed increment (design
 * doc §13 increments 2–3). Nothing here runs until the Phase 7 cutover — the `[...all]` route is
 * not mounted, and `emailVerified` stays a `DateTime` column until then.
 */
export const ssoDatabaseHooks: NonNullable<BetterAuthOptions["databaseHooks"]> = {
  user: {
    create: {
      before: async (user, context) => {
        const provider = getSsoProviderFromContext(context);
        const identityProvider = provider ? normalizeSsoProvider(provider) : null;
        if (!identityProvider) return; // not an SSO sign-up (e.g. email/password) → keep defaults
        // SSO IdPs attest the user's email, so it's verified at creation; denormalize the provider.
        // Returned `data` is shallow-merged over the row → a single INSERT, no follow-up UPDATE.
        return { data: { emailVerified: true, identityProvider } };
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
