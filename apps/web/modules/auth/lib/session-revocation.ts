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
 * design upstream (ENG-2591).
 *
 * Do not read that as "5 minutes of exposure": the window is bounded but what can be done inside it is
 * not. A still-cached session can mint an API key or complete an OAuth authorization, neither of which
 * expires with the session. That is why the ENG-2557 strip revokes OAuth grants in its transaction
 * rather than relying on the sweep alone.
 *
 * One upstream wrinkle: `deleteSessions` prunes the per-token keys and the rows but does not rewrite the
 * `active-sessions-<userId>` index, so `auth.api.listSessions` keeps listing revoked sessions until their
 * TTL. No security consequence — `getSession` needs the per-token key, which is gone — but an "active
 * sessions" view lies immediately after a revocation.
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

/**
 * Revoke one session by its (unsigned) token, across both stores. Same rationale as above — a raw
 * Prisma delete leaves the Redis copy resolvable by `getSession` until its TTL — for callers that hold a
 * token rather than a user id, like the SSO-recovery failure path killing the session its cookie names.
 */
export const revokeSessionByToken = async (sessionToken: string): Promise<void> => {
  const { auth } = await import("@/modules/auth/lib/auth");
  const ctx = await auth.$context;
  await ctx.internalAdapter.deleteSessions([sessionToken]);
};
