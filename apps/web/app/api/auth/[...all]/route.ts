import { auth } from "@/modules/auth/lib/auth";
import { runWithSsoRequestContext } from "@/modules/ee/sso/lib/sso-request-context";

// Force-no-store so Better Auth's outbound SSO fetches (token exchange, userinfo, JWKS) are never
// served from Next's fetch cache — carried over from the NextAuth [...nextauth] route.
export const fetchCache = "force-no-store";

/**
 * Better Auth HTTP handler (ENG-1054 cutover) — replaces the NextAuth `[...nextauth]` catch-all (the
 * two cannot coexist: both own `/api/auth/*`). More specific `/api/auth/*` routes (the SAML bridge,
 * SSO-recovery completion) still take precedence over this catch-all.
 *
 * `auth.handler` is wrapped in `runWithSsoRequestContext` so the SSO database hooks can carry state
 * across the request via AsyncLocalStorage — the provisioning decision (`user.create.before` →
 * `user.create.after`) and the pending identity (`mapProfileToUser` → the collision-recovery
 * after-hook). A bare handler would make new-SSO-user sign-ups throw (the provisioning gate fails
 * loud when the context is missing). The store survives the awaited handler because the async work
 * starts synchronously inside `run()`.
 *
 * NOTE (S2 / observability): the old route also emitted the failed-`signedIn` audit + Sentry capture
 * on thrown errors. Success audit is covered by `signInAuditDatabaseHook`; the failure path is ported
 * separately via `onAPIError.onError` (+ a before-hook request stash).
 */
const handler = (request: Request): Promise<Response> =>
  runWithSsoRequestContext(() => auth.handler(request));

export { handler as GET, handler as POST };
