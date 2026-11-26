import { logger } from "@formbricks/logger";
import { loggableError } from "@/lib/utils/loggable-error";
import { auth, getDeclaredAuthPaths } from "@/modules/auth/lib/auth";
import { withAuthRequestBodyLimit } from "@/modules/auth/lib/auth-request-body-limit";
import {
  recordSsoCallbackOutcome,
  recordSsoCallbackThrow,
} from "@/modules/auth/lib/better-auth-observability";
import { createAuthPathLabeller } from "@/modules/auth/lib/better-auth-path-label";
import {
  type BetterAuthRequestContext,
  runWithBetterAuthRequestContext,
} from "@/modules/auth/lib/better-auth-request-context";
import { runWithEmailVerificationRequestContext } from "@/modules/auth/lib/email-verification-request-context";
import { mapLegacySsoCallbackRequest } from "@/modules/auth/lib/legacy-sso-callback";
import { prepareDcrRequest } from "@/modules/auth/lib/mcp-dcr-application-type";
import {
  type TOAuthStateCookieDiagnosis,
  diagnoseOAuthStateCookie,
} from "@/modules/auth/lib/oauth-state-cookie-diagnosis";
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
// This runs at MODULE LOAD in the `/api/auth/*` catch-all, so a single null or undefined entry in
// `auth.api` must not throw here and take down every auth request — the whole route, not just the label
// (`getDeclaredAuthPaths` reads `endpoint?.path` for that reason; see the same principle in
// better-auth-request-context.ts). The labeller ignores any non-string, so a nullish entry degrades that
// one endpoint to `unknown` instead of breaking sign-in.
const labelAuthPath = createAuthPathLabeller(getDeclaredAuthPaths());

/** The endpoint label every OAuth callback carries, built-in social and generic OAuth/SSO alike. */
const OAUTH_CALLBACK_LABEL = "/callback/*";

/**
 * Which state-cookie cause a `state_security_mismatch` on this callback would have (ENG-6692), for the
 * Sentry capture in better-auth-observability.ts. Diagnosed here, before the handler, because that capture
 * runs in Better Auth's synchronous logger and verifying the cookie's signature is asynchronous.
 *
 * Only on a GET callback, so no other request pays for it. A POST callback (`response_mode=form_post`) never
 * reaches the state check: Better Auth 1.7 redirects it to the GET callback first, and that GET is diagnosed.
 * Never a reason for a sign-in to fail either: any error
 * here leaves the context without a diagnosis. The cookie name and secret come from Better Auth's own
 * context, so they cannot drift from what `parseGenericState` reads.
 */
const diagnoseCallbackStateCookie = async (
  request: Request,
  path: string
): Promise<TOAuthStateCookieDiagnosis | undefined> => {
  if (path !== OAUTH_CALLBACK_LABEL || request.method !== "GET") return undefined;
  try {
    const context = await auth.$context;
    return diagnoseOAuthStateCookie(request, {
      name: context.createAuthCookie("state").name,
      secret: context.secret,
    });
  } catch (error) {
    // Observability only: Better Auth still runs its own state check on this request, so a failed
    // diagnosis costs the tag, never the sign-in. Logged so a broken diagnosis does not vanish silently.
    logger.warn({ err: loggableError(error) }, "OAuth state cookie diagnosis failed");
    return undefined;
  }
};

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
 * on thrown errors. The success audit is covered by `signInAuditPlugin`; the failure audit by
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
  // registration (see each module). The DCR redirect-URI allowlist (ENG-3086, ENG-3471) rides the same
  // body read and rejects registrations whose redirect URIs are neither loopback nor an exact hosted
  // connector callback, before Better Auth sees them. All three no-op otherwise.
  const preparedRequest = await prepareDcrRequest(mapLegacySsoCallbackRequest(request));
  // A rejected DCR registration is the one early return here. It runs before auth.handler, so it skips
  // Better Auth's `/oauth2/register` rate limit (5/min) and the SSO-callback observability below — both
  // acceptable: a rejected registration writes no client row (the limit exists to cap client creation,
  // and this check actually strengthens that cap) and is not a callback. Re-limiting here would cost a
  // Redis round-trip to save one JSON parse, which is the wrong trade.
  if (preparedRequest instanceof Response) return preparedRequest;
  const mappedRequest = preparedRequest;
  const path = labelAuthPath(mappedRequest.url);
  const oauthStateCookie = await diagnoseCallbackStateCookie(mappedRequest, path);
  const requestContext: BetterAuthRequestContext = {
    path,
    method: mappedRequest.method,
    ...(oauthStateCookie && { oauthStateCookie }),
  };
  try {
    const response = await runWithBetterAuthRequestContext(requestContext, () =>
      runWithSsoRequestContext(() =>
        // ENG-2562: carries "this request just verified an email" from Better Auth's
        // `afterEmailVerification` hook to the `hooks.after` chain, which is where the session can
        // actually be minted. Innermost because it is the narrowest scope of the three — one endpoint,
        // not the whole handler.
        runWithEmailVerificationRequestContext(() => auth.handler(mappedRequest))
      )
    );
    // ENG-2551: the one place that sees the outcome of every SSO callback, whatever went wrong and
    // whichever provider it was — a failed callback is a redirect carrying `?error=`, or a 4xx/5xx.
    // Emitted here rather than from a hook because the failures that matter most are the ones Better
    // Auth returns as a response rather than throwing, so no error-path hook observes them.
    recordSsoCallbackOutcome(mappedRequest.url, response);
    return response;
  } catch (error) {
    // A throw is the most severe callback failure there is — Next answers 500 and the user cannot sign
    // in — so it must not be the one case the signal misses. Recorded, then rethrown unchanged so the
    // existing error handling (and the Sentry capture in this module) behaves exactly as before.
    recordSsoCallbackThrow(mappedRequest.url);
    throw error;
  }
};

// Bounded before anything above reads the body: the DCR parse, Better Auth's own reads, and every
// other `/api/auth/*` route (the SAML bridge, SSO recovery) go through the same guard (ENG-3846).
const limitedHandler = withAuthRequestBodyLimit(handler);

export { limitedHandler as GET, limitedHandler as POST };
