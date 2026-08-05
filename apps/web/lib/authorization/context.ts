import "server-only";
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
  jobs: TComparisonJob[];
  scheduled: boolean;
  surface: TAuthorizationSurface;
};

const globalForAuthorization = globalThis as unknown as {
  formbricksAuthorizationContext: AsyncLocalStorage<TAuthorizationContext> | undefined;
};

const authorizationContext =
  globalForAuthorization.formbricksAuthorizationContext ?? new AsyncLocalStorage<TAuthorizationContext>();

if (process.env.NODE_ENV !== "production") {
  globalForAuthorization.formbricksAuthorizationContext = authorizationContext;
}

const COMPARISON_CONCURRENCY = 4;

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

  const context: TAuthorizationContext = { jobs: [], scheduled: false, surface };

  return authorizationContext.run(context, async () => {
    try {
      after(() => drainComparisons(context.jobs));
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

export const enqueueAuthorizationComparison = (job: TComparisonJob): boolean => {
  const context = authorizationContext.getStore();
  if (!context?.scheduled) return false;
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
