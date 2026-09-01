import "server-only";
import { after } from "next/server";
import { AsyncLocalStorage } from "node:async_hooks";
import { cache as reactCache } from "react";
import { recordAuthorizationChecksPerRequest } from "./metrics";

/**
 * `page` is the server-rendered route surface (React Server Components), added for ENG-2388.
 *
 * Unlike every other surface, it is not established at a single request boundary: Next.js gives no RSC
 * equivalent of the action-client or API wrapper, and a layout's render and its page's render are
 * separate async contexts. It is therefore opened at the authorization choke points every product
 * route already funnels through, and opening it more than once is idempotent rather than nesting.
 *
 * **`page` is request-scoped; every other surface is callback-scoped.** That difference is ENG-2444.
 * `AsyncLocalStorage` closes when the awaited callback returns, so the surface used to end with the
 * choke-point helper: a page that awaited `getWorkspaceAuth()` and then authorized anything else did
 * so with no surface, and those decisions were labelled `unscoped` in the authoritative decision
 * telemetry the direct-authority rollout is monitored on. Nine routes were affected, two of them
 * issuing one such check *per feedback directory* or *per dashboard widget*.
 *
 * `page` is now held in a React `cache()` slot, which is scoped to the whole render pass, so a layout
 * and its page share one context and it outlives every helper. Two consequences, both improvements on
 * what this comment used to record:
 *
 * A navigation records ONE checks-per-request observation rather than one per choke point, which is
 * the N+1 signal that histogram exists for.
 *
 * `getAuthorizationSurface()` reports `page` for the whole render instead of `unscoped` after the first
 * helper returns, so `formbricks_authzed_authorization_decisions_total` attributes page traffic
 * correctly.
 *
 * Outside a React request scope — scripts, unit tests, any non-RSC caller — `cache()` does not
 * memoize, so there is no slot to hold. `page` then falls back to the `AsyncLocalStorage` boundary,
 * which is the pre-ENG-2444 behaviour: narrower than a render scope, but correct for a caller with no
 * render to scope to.
 */
export type TAuthorizationSurface =
  | "server_action"
  | "page"
  | "api_v1"
  | "api_v2"
  | "api_v3"
  | "mcp"
  | "feedback_gateway";

type TAuthorizationContext = {
  checksIssued: number;
  surface: TAuthorizationSurface;
};

type TPageSurfaceSlot = { context: TAuthorizationContext | null };

const globalForAuthorization = globalThis as unknown as {
  formbricksAuthorizationContext: AsyncLocalStorage<TAuthorizationContext> | undefined;
  formbricksAuthorizationPageSurfaceSlot: (() => TPageSurfaceSlot) | undefined;
};

const authorizationContext =
  globalForAuthorization.formbricksAuthorizationContext ?? new AsyncLocalStorage<TAuthorizationContext>();

globalForAuthorization.formbricksAuthorizationContext = authorizationContext;

/**
 * One slot per React request scope. In an RSC render that is the whole render pass, so a layout and
 * its page resolve the same slot — which is what lets the `page` surface outlive the choke-point
 * helper that opened it.
 *
 * `reactCache` is already this codebase's memoization idiom (resolvers.ts, and both choke-point
 * modules); here it is used for its scope rather than to cache a value. The wrapper itself is pinned
 * to `globalThis` so duplicated Next.js server bundles still use the same React cache key.
 */
const getPageSurfaceSlot =
  globalForAuthorization.formbricksAuthorizationPageSurfaceSlot ??
  reactCache((): TPageSurfaceSlot => ({ context: null }));

globalForAuthorization.formbricksAuthorizationPageSurfaceSlot = getPageSurfaceSlot;

/**
 * Whether React is holding a request scope we can hang the `page` surface on.
 *
 * `cache()` only memoizes inside one — outside it (scripts, unit tests, the non-RSC bundle, where the
 * client build's `cache` is a permanent no-op) every call returns a fresh object, so identity is a
 * direct, dependency-free probe. Deliberately not named "is rendering": Next also establishes a scope
 * outside component rendering, and `page` is only ever *selected* by the caller — the ALS store is
 * consulted first, so an enclosing server-action or API surface always keeps precedence.
 */
const hasReactRequestScope = (slot: TPageSurfaceSlot): boolean => slot === getPageSurfaceSlot();

const createSurfaceContext = (surface: TAuthorizationSurface): TAuthorizationContext => ({
  checksIssued: 0,
  surface,
});

/**
 * Register the one post-response observation for a surface. Shared by both boundaries so they cannot
 * drift, and fail-safe: an unavailable `after()` costs the histogram observation, never the decision.
 */
const scheduleChecksPerRequestObservation = (context: TAuthorizationContext): void => {
  try {
    after(() => {
      try {
        recordAuthorizationChecksPerRequest(context.checksIssued, context.surface);
      } catch {
        // Telemetry must never alter an authoritative response.
      }
    });
  } catch {
    // A wrapper can be invoked outside a Next.js request in scripts/tests — `after()` is unavailable
    // there. The authorization decision remains authoritative; only the request histogram observation
    // is omitted.
  }
};

/** The surface answering for the current caller: an explicit ALS boundary first, else the page slot. */
const getActiveContext = (): TAuthorizationContext | null =>
  authorizationContext.getStore() ?? getPageSurfaceSlot().context;

export const withAuthorizationSurface = async <T>(
  surface: TAuthorizationSurface,
  callback: () => T | Promise<T>
): Promise<T> => {
  if (authorizationContext.getStore()) {
    return callback();
  }

  const pageSlot = getPageSurfaceSlot();
  if (hasReactRequestScope(pageSlot) && pageSlot.context) {
    // A request has one outer surface. Before `page` moved from ALS to React cache, a nested wrapper
    // inherited the page context through the early return above. Preserve that behavior so one render
    // cannot split its check count across multiple telemetry observations.
    return callback();
  }

  if (surface === "page") {
    if (hasReactRequestScope(pageSlot)) {
      // Opened once per render, then left open: every later check in the same render — including the
      // ones a page issues long after this helper returned — resolves through this slot.
      if (!pageSlot.context) {
        pageSlot.context = createSurfaceContext(surface);
        scheduleChecksPerRequestObservation(pageSlot.context);
      }
      return callback();
    }
    // No render to scope to: fall through to the async-scoped boundary, which is what this surface did
    // before ENG-2444. Narrower, but correct for a caller with no request scope.
  }

  const context = createSurfaceContext(surface);

  return authorizationContext.run(context, async () => {
    scheduleChecksPerRequestObservation(context);
    return callback();
  });
};

/**
 * Record that one central authorization operation was made. Scalar `can()`/`assertCan()` decisions and
 * narrow list observers each call this exactly once regardless of how much source data they process.
 * A no-op outside a surface — same fail-safe posture as the rest of this module — so scripts and tests
 * that never establish a surface are simply not counted rather than throwing.
 */
export const recordAuthorizationCheckIssued = (): void => {
  const context = getActiveContext();
  if (context) context.checksIssued += 1;
};

/** The number of central authorization operations in the current surface, or `null` outside one. */
export const getIssuedAuthorizationCheckCount = (): number | null => getActiveContext()?.checksIssued ?? null;

/** The current bounded request surface, or `unscoped` for scripts and non-request authorization calls. */
export const getAuthorizationSurface = (): TAuthorizationSurface | "unscoped" =>
  getActiveContext()?.surface ?? "unscoped";
