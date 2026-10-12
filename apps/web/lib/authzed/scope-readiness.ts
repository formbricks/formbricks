import "server-only";
import { prisma } from "@formbricks/database";
import { env } from "@/lib/env";

/**
 * Per-scope readiness of a SpiceDB projection (ENG-3282).
 *
 * A scope is ready once its backfill has converged and two consecutive audits came back clean — only
 * then may the evaluator decide from its relationships. Set and cleared only by the backfill CLI
 * (`--mark-ready`, `--clear-ready`); nothing on a request path writes it.
 *
 * While the survey scope is not ready, survey and response decisions collapse to workspace
 * permissions exactly as before the projection existed, so a fresh deploy changes nothing until an
 * operator marks it.
 */

export type TAuthzedProjectionScope = "survey";

/**
 * How long one readiness answer is reused. Same reasoning as the freshness memo: React `cache()` is a
 * no-op in Route Handlers, and a request makes many checks. The marker flips a handful of times in a
 * deployment's life, so five seconds of lag is the whole cost.
 */
export const SURVEY_VISIBILITY_READINESS_MEMO_TTL_MS = 5_000;

// Monotonic for the same reason as `outbox-freshness.ts`: a wall-clock step backwards would freeze the
// answer for its duration.
let memoizedAt = Number.NEGATIVE_INFINITY;
let memoizedValue = false;
let inFlight: Promise<boolean> | null = null;
// The last answer a read actually returned, kept past the TTL. Only a successful read changes it, so a
// failed read can tell "this deployment was enforcing" apart from "this deployment never was".
let lastReadValue: boolean | null = null;

const readSurveyReadiness = async (): Promise<boolean> => {
  const state = await prisma.authzedProjectionScopeState.findUnique({
    where: { scope: "survey" },
    select: { readyAt: true },
  });
  return state?.readyAt != null;
};

/**
 * Whether survey visibility is enforced on this deployment.
 *
 * `false` means exactly two things: the marker is not set, or `SURVEY_VISIBILITY_FORCE_DISABLED=1`
 * (checked before any read). A failed read is neither — every caller treats `false` as workspace-wide
 * legacy access, so answering it on an error would release restricted surveys. A failed read therefore
 * keeps enforcing when the last successful read saw the marker set, and rejects otherwise, so the
 * caller fails with its own error path (5xx, error page, retried job) rather than deciding. Neither
 * outcome is memoized: the next check reads again.
 */
export const isSurveyVisibilityReady = (): Promise<boolean> => {
  if (env.SURVEY_VISIBILITY_FORCE_DISABLED === "1") return Promise.resolve(false);
  if (performance.now() - memoizedAt < SURVEY_VISIBILITY_READINESS_MEMO_TTL_MS) {
    return Promise.resolve(memoizedValue);
  }

  // Concurrent checks share one read, so a fan-out does not become a burst of identical queries.
  inFlight ??= readSurveyReadiness()
    .then((ready) => {
      memoizedValue = ready;
      memoizedAt = performance.now();
      lastReadValue = ready;
      return ready;
    })
    .catch((error: unknown) => {
      if (lastReadValue === true) return true;
      throw error;
    })
    .finally(() => {
      inFlight = null;
    });

  return inFlight;
};

/** Test seam: forget the memoized answer. */
export const resetSurveyVisibilityReadinessMemo = (): void => {
  memoizedAt = Number.NEGATIVE_INFINITY;
  memoizedValue = false;
  inFlight = null;
  lastReadValue = null;
};

export const setProjectionScopeReady = async (
  scope: TAuthzedProjectionScope,
  readyBy: string
): Promise<void> => {
  const readyAt = new Date();
  await prisma.authzedProjectionScopeState.upsert({
    where: { scope },
    create: { readyAt, readyBy, scope },
    update: { readyAt, readyBy },
  });
};

export const clearProjectionScopeReady = async (scope: TAuthzedProjectionScope): Promise<void> => {
  await prisma.authzedProjectionScopeState.upsert({
    where: { scope },
    create: { readyAt: null, readyBy: null, scope },
    update: { readyAt: null, readyBy: null },
  });
};

/** Readiness of every scope, for `authzed:upgrade check`. Uncached: it is an operator read. */
export const readProjectionScopeReadiness = async (): Promise<
  Readonly<Record<TAuthzedProjectionScope, "not-ready" | "ready">>
> => {
  const state = await prisma.authzedProjectionScopeState.findUnique({
    where: { scope: "survey" },
    select: { readyAt: true },
  });
  return { survey: state?.readyAt == null ? "not-ready" : "ready" };
};
