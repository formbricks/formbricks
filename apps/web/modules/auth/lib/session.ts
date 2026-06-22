import "server-only";
import type { Session } from "next-auth";
import { headers } from "next/headers";
import { cache } from "react";
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
 * Returns the same augmented NextAuth `Session` shape those call sites already consume
 * (`session.user.id` + `session.user.email`; see packages/types/next-auth.d.ts) so it stays a
 * drop-in. A 2FA-pending login resolves to `null`: Better Auth deletes the credential session and
 * issues a short-lived two-factor cookie until the code is verified, so no authenticated session
 * exists yet.
 *
 * PR3 (decommission): replace the `next-auth` `Session` type with a local equivalent once next-auth
 * is removed.
 */
export const getSession = cache(async (): Promise<Session | null> => {
  const result = await auth.api.getSession({ headers: await headers() });
  if (!result?.user) {
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
