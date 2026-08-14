import "server-only";
import { after } from "next/server";
import { AsyncLocalStorage } from "node:async_hooks";
import {
  type TAuthzedAuthorizationRolloutTarget,
  isAuthzedAuthorizationRolloutTarget,
} from "@/lib/authzed/rollout-contract";
import type { TAuthorizationActor } from "./contract";
import { recordAuthorizationChecksPerRequest } from "./metrics";

export type TAuthorizationSurface = "server_action" | "api_v1" | "api_v2" | "api_v3" | "mcp";

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
