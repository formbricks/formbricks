import { auth } from "@/modules/auth/lib/auth";
import { createAuthPathLabeller } from "@/modules/auth/lib/better-auth-path-label";
import { runWithBetterAuthRequestContext } from "@/modules/auth/lib/better-auth-request-context";
import { runWithSsoRequestContext } from "@/modules/ee/sso/lib/sso-request-context";

// Force-no-store so Better Auth's outbound SSO fetches (token exchange, userinfo, JWKS) are never
// served from Next's fetch cache — carried over from the NextAuth [...nextauth] route.
export const fetchCache = "force-no-store";

/**
 * Derived once from Better Auth's own endpoint registry (each endpoint function carries its DECLARED
 * path), so the label vocabulary tracks plugin and version changes with no hand-maintained list — and
 * a parameterized route can never be emitted with its parameter filled in. See
 * better-auth-path-label.ts; `/reset-password/:token` is why this is not the raw pathname.
 */
const labelAuthPath = createAuthPathLabeller(Object.values(auth.api).map((endpoint) => endpoint.path));

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
 * `runWithBetterAuthRequestContext` sits OUTSIDE that so it also covers the middleware Better Auth
 * runs ahead of `hooks.before` (origin check, CSRF, rate limiter): it carries the endpoint label into
 * the Sentry capture in better-auth-observability.ts, which otherwise reports a bare exception with no
 * route at all (ENG-2259 / FORMBRICKS-183).
 *
 * NOTE (S2 / observability): the old route also emitted the failed-`signedIn` audit + Sentry capture
 * on thrown errors. The success audit is covered by `signInAuditDatabaseHook`; the failure audit by
 * `auditFailedAuthAfter` in `hooks.after`, because a rejected sign-in is a handled `APIError`
 * *response* rather than a throw. `onAPIError.onError` is deliberately NOT configured: Better Auth
 * calls it and `return`s (`better-auth/dist/api/index.mjs:194-197`), skipping the logger path
 * entirely — wiring it would silence the very capture that surfaces genuine internal faults.
 */
const handler = (request: Request): Promise<Response> =>
  runWithBetterAuthRequestContext({ path: labelAuthPath(request.url), method: request.method }, () =>
    runWithSsoRequestContext(() => auth.handler(request))
  );

export { handler as GET, handler as POST };
