import type { TSurveyVisibility } from "@formbricks/types/surveys/types";
import { getPendingVisibility } from "@/lib/survey/visibility/policy";

/**
 * The visibility state machine of contract §3, pure so every branch is testable without a database.
 *
 * `enforced` is what the survey is on this request (pending counts as restricted); `pending` is a stored
 * value the graph has not acknowledged. A request is one of:
 *
 * - **noop** — the enforced value, with nothing pending: nothing is written or audited;
 * - **cancel** — the enforced value while the *opposite* is pending: a new version supersedes it;
 * - **retry** — the pending value again: re-attempt the projection, nothing new stored;
 * - **change** — a real change in `direction`;
 * - **reject** — `restricted` for an ownerless survey (422, checked first: it cannot be fixed) or while
 *   outbound connections depend on it (409).
 */
export type TVisibilityTransitionRow = Readonly<{
  ownerId: string | null;
  visibility: TSurveyVisibility;
  visibilityProjectedVersion: number;
  visibilityVersion: number;
}>;

export type TVisibilityTransitionPlan =
  | Readonly<{ kind: "noop" }>
  | Readonly<{ kind: "cancel"; to: TSurveyVisibility }>
  | Readonly<{ kind: "retry"; to: TSurveyVisibility }>
  | Readonly<{ kind: "change"; to: TSurveyVisibility }>
  | Readonly<{
      code: "visibility_blocked_by_connections" | "visibility_change_not_allowed";
      kind: "reject";
      status: 409 | 422;
    }>;

const rejectPrivate = (
  row: TVisibilityTransitionRow,
  blockerCount: number
): Extract<TVisibilityTransitionPlan, { kind: "reject" }> | null => {
  if (row.ownerId === null) return { code: "visibility_change_not_allowed", kind: "reject", status: 422 };
  if (blockerCount > 0) return { code: "visibility_blocked_by_connections", kind: "reject", status: 409 };
  return null;
};

export const planVisibilityTransition = ({
  blockerCount,
  requested,
  row,
}: Readonly<{
  blockerCount: number;
  requested: TSurveyVisibility;
  row: TVisibilityTransitionRow;
}>): TVisibilityTransitionPlan => {
  const pending = getPendingVisibility(row);

  if (pending === null) {
    if (requested === row.visibility) return { kind: "noop" };
    if (requested === "restricted")
      return rejectPrivate(row, blockerCount) ?? { kind: "change", to: "restricted" };
    return { kind: "change", to: "workspace" };
  }

  if (requested === pending) {
    // Re-attempting a queued restriction needs no precondition: it is already enforced.
    if (requested === "restricted") return { kind: "retry", to: "restricted" };
    return { kind: "retry", to: "workspace" };
  }

  // Requesting the other value while something is pending cancels it. Going back to restricted is a
  // restriction like any other, so it is refused on the same grounds.
  if (requested === "restricted")
    return rejectPrivate(row, blockerCount) ?? { kind: "cancel", to: "restricted" };
  return { kind: "cancel", to: "workspace" };
};

/**
 * The values a `POST` by this caller would act on now (contract §3): never the enforced value unless a
 * different one is pending (then it is the cancel), and never `restricted` while it would be refused.
 */
export const getAllowedVisibilityTargets = (
  row: TVisibilityTransitionRow,
  blockerCount: number
): TSurveyVisibility[] => {
  const targets: TSurveyVisibility[] = [];
  for (const requested of ["workspace", "restricted"] as const) {
    const plan = planVisibilityTransition({ blockerCount, requested, row });
    if (plan.kind !== "noop" && plan.kind !== "reject") targets.push(requested);
  }
  return targets;
};
