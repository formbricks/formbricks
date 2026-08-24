import "server-only";
import { logger } from "@formbricks/logger";
import { getSessionTokensByUserId } from "@/modules/auth/lib/auth-session-repository";

/**
 * Revoke every session a user holds except one, across BOTH session stores.
 *
 * Sessions live in two places (see `auth.ts`): Postgres, because `session.storeSessionInDatabase` is
 * required for the forward-auth proxies, and Redis via `secondaryStorage`. `findSession` consults Redis
 * first, so a bare `prisma.session.deleteMany()` is NOT a revocation — it leaves the session fully valid
 * for `auth.api.getSession` while breaking only the proxy path, which is strictly worse than doing
 * nothing. Better Auth's `internalAdapter.deleteSessions` clears both: `secondaryStorage.delete(token)`
 * per token, then the rows.
 *
 * Enumeration comes from Postgres (`getSessionTokensByUserId`) rather than `internalAdapter.listSessions`,
 * which under `secondaryStorage` reads only the `active-sessions-<userId>` index and returns an empty
 * list if that key was evicted — silently revoking nothing.
 *
 * Known residual, shared with `revokeSessionsOnPasswordReset`: `cookieCache` serves a still-valid
 * `session_data` cookie from its signature alone, so a revoked session's holder keeps a cached session
 * for up to `cookieCache.maxAge` (5 min in auth.ts) without ever hitting either store. Stateless by
 * design upstream; revocation here is effective at the stores and complete once the cache expires.
 *
 * `auth` is imported dynamically on purpose: `auth.ts` → `better-auth-hooks.ts` → `sso-recovery.ts`, so a
 * static import here would close an import cycle for this module's callers. Same reason `auth.ts` reaches
 * for `await import("@/modules/email")`.
 *
 * @returns the number of sessions revoked.
 */
export const revokeUserSessionsExcept = async ({
  userId,
  keepSessionToken,
}: {
  userId: string;
  keepSessionToken?: string;
}): Promise<number> => {
  const tokens = (await getSessionTokensByUserId(userId)).filter((token) => token !== keepSessionToken);

  if (tokens.length === 0) {
    return 0;
  }

  const { auth } = await import("@/modules/auth/lib/auth");
  const ctx = await auth.$context;
  await ctx.internalAdapter.deleteSessions(tokens);

  logger.info({ userId, revoked: tokens.length }, "Revoked user sessions");

  return tokens.length;
};
