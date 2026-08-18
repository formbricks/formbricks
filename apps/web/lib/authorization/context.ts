import "server-only";
import { after } from "next/server";
import { AsyncLocalStorage } from "node:async_hooks";
import {
  type TAuthzedAuthorizationRolloutTarget,
  isAuthzedAuthorizationRolloutTarget,
} from "@/lib/authzed/rollout-contract";
import type { TAuthorizationActor } from "./contract";
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
 * issues further central checks (`feedbackDirectoryAssignment.read` via
 * `getAuthorizedWorkspaceFeedbackDirectories`, `organization.manage` on the taxonomy page) makes
 * those checks outside any surface. `can()` then answers from the legacy evaluator whatever the
 * rollout selects, so they produce no shadow evidence *and* would bypass enforcement. Those checks
 * are counted by `formbricks_authzed_authorization_unscoped_checks_total`, because otherwise the
 * gap is indistinguishable from a clean cutover: nothing compares, so nothing ever mismatches.
 *
 * Closing it needs a boundary that survives past the helper — a request-scoped store (React `cache`)
 * rather than an async-scoped one. That is deliberately out of scope here, because it replaces this
 * module's context mechanism and cannot be covered by a unit test: `cache` does not dedupe outside a
 * render, so proving it needs a render harness or an E2E. Until that lands, `page:user` belongs in
 * shadow only and must not be added to an enforcement list.
 */
export type TAuthorizationSurface =
  | "server_action"
  | "page"
  | "api_v1"
  | "api_v2"
  | "api_v3"
  | "mcp"
  | "feedback_gateway";

type TComparisonJob = () => Promise<void>;

type TAuthorizationContext = {
  checksIssued: number;
  jobs: TComparisonJob[];
  scheduled: boolean;
  surface: TAuthorizationSurface;
};

const globalForAuthorization = globalThis as unknown as {
  formbricksAuthorizationContext: AsyncLocalStorage<TAuthorizationContext> | undefined;
};

const authorizationContext =
  globalForAuthorization.formbricksAuthorizationContext ?? new AsyncLocalStorage<TAuthorizationContext>();

globalForAuthorization.formbricksAuthorizationContext = authorizationContext;

const COMPARISON_CONCURRENCY = 4;
const MAX_COMPARISON_JOBS = 100;

const drainComparisons = async (jobs: ReadonlyArray<TComparisonJob>): Promise<void> => {
  for (let index = 0; index < jobs.length; index += COMPARISON_CONCURRENCY) {
    await Promise.allSettled(jobs.slice(index, index + COMPARISON_CONCURRENCY).map((job) => job()));
  }
};

export const withAuthorizationSurface = async <T>(
  surface: TAuthorizationSurface,
  callback: () => T | Promise<T>
): Promise<T> => {
  if (authorizationContext.getStore()) {
    return callback();
  }

  const context: TAuthorizationContext = { checksIssued: 0, jobs: [], scheduled: false, surface };

  return authorizationContext.run(context, async () => {
    try {
      // Recorded here rather than after the callback: `after()` can run once the response has been
      // sent, so this is the last point guaranteed to execute for every request, success or thrown.
      after(() => {
        try {
          recordAuthorizationChecksPerRequest(context.checksIssued, surface);
        } catch {
          // Instrumentation must never gate the comparison drain. Next swallows errors thrown from
          // an `after()` callback, so an exception here would silently stop shadow comparisons for
          // this request — a new metric taking out functionality that already worked. Every other
          // failure path in this module is deliberately fail-safe; this one has to be too.
        }

        return drainComparisons(context.jobs);
      });
      context.scheduled = true;
    } catch {
      // A wrapper can be invoked outside a Next.js request in scripts/tests — `after()` is
      // unavailable there. This path is expected in dev tooling (authzed:perf, authzed:backfill,
      // integration tests); it is never reached inside a real Next.js request. When it fires,
      // neither the histogram nor the comparison drain will execute for this surface — the
      // per-request count is still functional via `recordAuthorizationCheckIssued`.
      context.scheduled = false;
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

export const enqueueAuthorizationComparison = (job: TComparisonJob): boolean => {
  const context = authorizationContext.getStore();
  if (!context?.scheduled || context.jobs.length >= MAX_COMPARISON_JOBS) return false;
  context.jobs.push(job);
  return true;
};

export const getAuthorizationRolloutTarget = (
  actorType: TAuthorizationActor["type"]
): TAuthzedAuthorizationRolloutTarget | null => {
  const context = authorizationContext.getStore();
  if (!context) return null;

  const target = `${context.surface}:${actorType}`;
  return isAuthzedAuthorizationRolloutTarget(target) ? target : null;
};
