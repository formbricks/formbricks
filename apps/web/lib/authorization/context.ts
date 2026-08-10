import "server-only";
import { metrics } from "@opentelemetry/api";
import { after } from "next/server";
import { AsyncLocalStorage } from "node:async_hooks";
import {
  type TAuthzedAuthorizationRolloutTarget,
  isAuthzedAuthorizationRolloutTarget,
} from "@/lib/authzed/rollout-contract";
import type { TAuthorizationActor } from "./contract";

export type TAuthorizationSurface = "server_action" | "api_v1" | "api_v2" | "api_v3" | "mcp";

type TComparisonJob = () => Promise<void>;

type TAuthorizationContext = {
  checksIssued: number;
  jobs: TComparisonJob[];
  scheduled: boolean;
  surface: TAuthorizationSurface;
};

/**
 * ENG-1739: how many `can()`/`assertCan()` decisions one request made.
 *
 * This is the one thing the perf harness cannot measure — it times a single decision, never how many
 * a page or endpoint issues. A workspace-scoped list path that authorizes once still "works" under
 * that harness even if a regression made it authorize once per row; only a per-request count can see
 * that. `checks_per_request` is the metric this exists to produce, and it is deliberately request-
 * scoped rather than global, so the number means "this one page load", not a rate across all traffic.
 */
const meter = metrics.getMeter("formbricks.authorization");
const checksPerRequest = meter.createHistogram("formbricks_authorization_checks_per_request", {
  advice: { explicitBucketBoundaries: [1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 250, 500, 1000] },
  description: "Number of central authorization decisions made while handling one request",
});

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
        checksPerRequest.record(context.checksIssued, { surface });
        return drainComparisons(context.jobs);
      });
      context.scheduled = true;
    } catch {
      // A wrapper can be invoked outside a Next.js request in scripts/tests.
      // Rollout remains fail-safe: no background comparison is accepted when
      // the platform cannot extend the request lifetime.
      context.scheduled = false;
    }

    return callback();
  });
};

/**
 * Record that one central authorization decision was made. Called from `can()` itself, so every
 * `can()`/`assertCan()` call counts once regardless of which evaluator answered it. A no-op outside a
 * surface — same fail-safe posture as the rest of this module — so scripts and tests that never
 * establish a surface are simply not counted rather than throwing.
 */
export const recordAuthorizationCheckIssued = (): void => {
  const context = authorizationContext.getStore();
  if (context) context.checksIssued += 1;
};

/** The number of `can()` decisions made so far in the current surface, or `null` outside one. */
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
