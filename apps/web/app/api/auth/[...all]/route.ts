import { auth } from "@/modules/auth/lib/auth";
import { createAuthPathLabeller } from "@/modules/auth/lib/better-auth-path-label";
import { runWithBetterAuthRequestContext } from "@/modules/auth/lib/better-auth-request-context";
import { mapLegacySsoCallbackRequest } from "@/modules/auth/lib/legacy-sso-callback";
import { normalizeDcrRequest } from "@/modules/auth/lib/mcp-dcr-application-type";
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
// `endpoint?.path`, not `endpoint.path`: this runs at MODULE LOAD in the `/api/auth/*` catch-all, so a
// single null or undefined entry in `auth.api` would throw here and take down every auth request — the
// whole route, not just the label. That is the one thing this file must not do for the sake of a Sentry
// tag (see the same principle in better-auth-request-context.ts). The labeller already ignores any
// non-string, so a nullish entry degrades that one endpoint to `unknown` instead of breaking sign-in.
const labelAuthPath = createAuthPathLabeller(Object.values(auth.api).map((endpoint) => endpoint?.path));

/**
 * Better Auth HTTP handler (ENG-1054 cutover) — replaces the NextAuth `[...nextauth]` catch-all (the
 * two cannot coexist: both own `/api/auth/*`). More specific `/api/auth/*` routes (the SAML bridge,
 * SSO-recovery completion) still take precedence over this catch-all.
 *
 * It also serves the pinned SSO callback path via `mapLegacySsoCallbackRequest` (ENG-2343), which is
 * why no separate `/api/auth/oauth2/callback/[providerId]` route exists: nothing else claims that path,
 * so the catch-all already receives it. The mapping runs FIRST, and everything below reads the mapped
 * request — the label especially. `/api/auth/oauth2/callback/{providerId}` is not a path Better Auth
 * declares, so labelling the raw URL would bucket an SSO callback under `/oauth2/*`, which is the MCP
 * OAuth authorization-server facet: the one place a reader must not confuse it with.
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
const handler = async (request: Request): Promise<Response> => {
  // Before anything else reads the path: this catch-all serves the pinned v5.2 SSO callback URL, which no
  // Better Auth version mounts a handler on any more. Everything downstream — the endpoint label, the SSO
  // hooks, the audits — reads the MAPPED request, so each sees the endpoint that actually ran.
  // Two normalisations, both because 1.7 changed a contract that clients and IdPs already depend on and
  // neither is ours to change: the pinned SSO callback path, and `application_type` on dynamic client
  // registration (see each module). Both no-op for every other request.
  const mappedRequest = await normalizeDcrRequest(mapLegacySsoCallbackRequest(request));
  return runWithBetterAuthRequestContext(
    { path: labelAuthPath(mappedRequest.url), method: mappedRequest.method },
    () => runWithSsoRequestContext(() => auth.handler(mappedRequest))
  );
};

export { handler as GET, handler as POST };
