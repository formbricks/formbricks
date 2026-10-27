import "server-only";
import { isAPIError } from "better-auth/api";
import { headers } from "next/headers";
import { cache } from "react";
import { prisma } from "@formbricks/database";
import { logger } from "@formbricks/logger";
import type { Session } from "@formbricks/types/auth";
import { auth } from "@/modules/auth/lib/auth";

/**
 * Request-scoped session read — the single identity choke point for the app (ENG-1054 DAL).
 *
 * Cutover: reads the Better Auth session ONLY (`auth.api.getSession`), wrapped in React `cache()`
 * for per-request dedupe and marked `server-only`. NextAuth cookies are intentionally NOT honored —
 * the cutover is a one-time forced re-login (sessions aren't portable across Better Auth's cookie
 * signing + the schema change; see eng-1054-cutover-runbook.md §0/D3), so there is deliberately no
 * dual-read. Centralizing every read here keeps the flip a single-file change rather than a sweep of
 * the ~33 former `getServerSession` call sites.
 *
 * Returns the same `Session` shape those call sites already consume (`session.user.id` +
 * `session.user.email`; see packages/types/auth.ts) so it stays a drop-in. A 2FA-pending login
 * resolves to `null`: Better Auth deletes the credential session and issues a short-lived
 * two-factor cookie until the code is verified, so no authenticated session exists yet.
 */
/**
 * The Postgres `Session` row is the authority on whether a session exists; Redis and the cookie cache
 * are only copies of it.
 *
 * Better Auth serves this session from Redis secondary storage and a 5-minute signed cookie cache, so
 * neither the session record nor `result.user` reflects a session whose row was deleted, or a user who
 * was deactivated, after signing in. `rejectInactiveUserOnSessionCreate` only gates session *creation*.
 * Without this read a deactivated user keeps full access — server actions, v3 session routes, storage —
 * for the life of a rolling 1-day session, and a session whose row is gone (a user-delete cascade, a bare
 * `prisma.session.deleteMany()`, a restore) stays valid until its Redis TTL (ENG-3418). It is the same
 * lookup `getProxySession` makes for the middleware, so the two cannot disagree on who is signed in.
 */
const isSessionLive = async (sessionToken: string, userId: string): Promise<boolean> => {
  const session = await prisma.session.findUnique({
    where: { sessionToken },
    select: { userId: true, user: { select: { isActive: true } } },
  });

  // A session whose user row is gone has no row either: the delete cascades.
  return session?.userId === userId && session.user.isActive === true;
};

/**
 * Better Auth's answer when a session it just served from Redis cannot be refreshed in Postgres: it
 * deletes the session cookie and throws `UNAUTHORIZED` / `FAILED_TO_GET_SESSION`
 * (`better-auth/dist/api/routes/session.mjs`, "concurrent deletion"). That is a signed-out user, not a
 * fault — left uncaught it crashes the page instead of redirecting to login (ENG-3418). Any other error,
 * such as `INTERNAL_SERVER_ERROR` when both stores fail, is a real outage and still throws.
 * `better-auth-session-fallback.test.ts` fails if a version bump changes this error's shape.
 */
const isVanishedSessionError = (error: unknown): boolean =>
  isAPIError(error) &&
  error.status === "UNAUTHORIZED" &&
  (error.body as { code?: string } | undefined)?.code === "FAILED_TO_GET_SESSION";

const getBetterAuthSession = async () => {
  try {
    return await auth.api.getSession({ headers: await headers() });
  } catch (error) {
    if (!isVanishedSessionError(error)) throw error;
    logger.warn("Better Auth could not refresh a session missing from the database; treating as signed out");
    return null;
  }
};

export const getSession = cache(async (): Promise<Session | null> => {
  const result = await getBetterAuthSession();
  if (!result?.user) {
    return null;
  }

  if (!(await isSessionLive(result.session.token, result.user.id))) {
    return null;
  }

  return {
    user: {
      id: result.user.id,
      email: result.user.email,
      name: result.user.name,
    },
    // BA exposes `expiresAt` as a Date, but secondary-storage round-trips can hand back a string;
    // normalize both to the ISO string NextAuth's `Session.expires` contract guarantees.
    expires: new Date(result.session.expiresAt).toISOString(),
  };
});
