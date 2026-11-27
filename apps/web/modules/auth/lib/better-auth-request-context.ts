import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";
import type { TOAuthStateCookieDiagnosis } from "./oauth-state-cookie-diagnosis";

/**
 * Request scope for Better Auth observability (ENG-2259).
 *
 * Better Auth's router discards the endpoint before our logger is called — for a non-`APIError` it does
 * `ctx.logger?.error(e.name, e)` (`better-auth/dist/api/index.mjs:210`) — so the Sentry event raised in
 * `better-auth-observability.ts` carries an exception and nothing else: no transaction, no URL, no
 * route. That is why FORMBRICKS-183 has ~242 events and cannot be triaged. This store carries the
 * request identity across the handler so the capture can name its endpoint.
 *
 * The `[...all]` route opens it around `auth.handler`, which means it covers every throw inside the
 * handler — including the middleware that runs AHEAD of `hooks.before` (origin check, CSRF, rate
 * limiter), which a before-hook stash cannot see. The store survives the awaited handler because the
 * async work starts synchronously inside `run()`, the same guarantee `sso-request-context.ts` relies
 * on.
 *
 * `path` is already reduced to a safe label by `createAuthPathLabeller` — never a raw path. See
 * `better-auth-path-label.ts` for why that matters (`/reset-password/:token`).
 */
export interface BetterAuthRequestContext {
  /** Safe endpoint label from `createAuthPathLabeller`, e.g. `/sign-in/email` or `/reset-password/*`. */
  path: string;
  /** HTTP method, e.g. `POST`. */
  method: string;
  /**
   * On an OAuth callback only: which state-cookie cause a `state_security_mismatch` would have (ENG-6692).
   * Diagnosed by the route before the handler runs, because the logger that captures the throw is
   * synchronous and verifying the cookie's signature is not. A label, never the cookie or the state.
   */
  oauthStateCookie?: TOAuthStateCookieDiagnosis;
}

const betterAuthRequestContext = new AsyncLocalStorage<BetterAuthRequestContext>();

export const runWithBetterAuthRequestContext = <T>(context: BetterAuthRequestContext, fn: () => T): T =>
  betterAuthRequestContext.run(context, fn);

/**
 * Best-effort by design: `undefined` when the fault is raised outside the HTTP handler — Better Auth
 * instance construction, or a server-side `auth.api.*` call. Observability must never be the thing
 * that breaks an auth request, and that absence is itself diagnostic: an untagged capture means the
 * throw did not come through `auth.handler`.
 */
export const getBetterAuthRequestContext = (): BetterAuthRequestContext | undefined =>
  betterAuthRequestContext.getStore();

/**
 * True while the current code runs inside an HTTP `POST /api/auth/sign-in/email`. The verification-email
 * callback reads it to send after the response instead of during it (ENG-2099): Better Auth sends there only
 * for an unverified account whose password matched, so a send on the response path makes that answer slower
 * than the identical wrong-password one. A server-side `auth.api.*` call opens no store, so it stays awaited.
 */
export const isPasswordSignInRequest = (): boolean =>
  getBetterAuthRequestContext()?.path === "/sign-in/email";
