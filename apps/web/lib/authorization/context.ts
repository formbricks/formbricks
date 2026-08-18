import "server-only";
import { after } from "next/server";
import { AsyncLocalStorage } from "node:async_hooks";
import { recordAuthorizationChecksPerRequest } from "./metrics";

/**
 * `page` is the server-rendered route surface (React Server Components), added for ENG-2388.
 *
 * Unlike every other surface, it is not established at a single request boundary: Next.js gives no RSC
 * equivalent of the action-client or API wrapper, and a layout's render and its page's render are
 * separate async contexts. It is therefore opened at the authorization choke points every product
 * route already funnels through. `withAuthorizationSurface` returns early when a surface is already
 * open, so opening it at more than one choke point is idempotent rather than nesting.
 *
 * Two consequences follow, and the second is a real coverage limit rather than a reporting quirk.
 *
 * The histogram splits: one navigation that runs both a layout check and a page check records two
 * observations rather than one. That weakens the N+1 signal slightly; it does not make it wrong.
 *
 * **The surface does not span the whole page.** `AsyncLocalStorage` scopes to the awaited callback,
 * so it closes when the choke-point helper returns — a page that calls `getWorkspaceAuth()` and then
 * issues further central checks makes those checks without a page label. They still use authoritative
 * SpiceDB, but are tagged `unscoped` in decision telemetry.
 *
 * Closing it needs a boundary that survives past the helper — a request-scoped store (React `cache`)
 * rather than an async-scoped one. That telemetry attribution improvement is separate from evaluator
 * authority and requires a render harness or E2E proof.
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

const globalForAuthorization = globalThis as unknown as {
  formbricksAuthorizationContext: AsyncLocalStorage<TAuthorizationContext> | undefined;
};

const authorizationContext =
  globalForAuthorization.formbricksAuthorizationContext ?? new AsyncLocalStorage<TAuthorizationContext>();

globalForAuthorization.formbricksAuthorizationContext = authorizationContext;

export const withAuthorizationSurface = async <T>(
  surface: TAuthorizationSurface,
  callback: () => T | Promise<T>
): Promise<T> => {
  if (authorizationContext.getStore()) {
    return callback();
  }

  const context: TAuthorizationContext = { checksIssued: 0, surface };

  return authorizationContext.run(context, async () => {
    try {
      after(() => {
        try {
          recordAuthorizationChecksPerRequest(context.checksIssued, surface);
        } catch {
          // Telemetry must never alter an authoritative response.
        }
      });
    } catch {
      // A wrapper can be invoked outside a Next.js request in scripts/tests — `after()` is
      // unavailable there. The authorization decision remains authoritative; only the request
      // histogram observation is omitted.
    }

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
  const context = authorizationContext.getStore();
  if (context) context.checksIssued += 1;
};

/** The number of central authorization operations in the current surface, or `null` outside one. */
export const getIssuedAuthorizationCheckCount = (): number | null =>
  authorizationContext.getStore()?.checksIssued ?? null;

/** The current bounded request surface, or `unscoped` for scripts and non-request authorization calls. */
export const getAuthorizationSurface = (): TAuthorizationSurface | "unscoped" =>
  authorizationContext.getStore()?.surface ?? "unscoped";
