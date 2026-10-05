import type { TSurveyVisibility } from "@formbricks/types/surveys/types";

/**
 * The two derived facts every ENG-3282 read path agrees on. Pure, so the list predicate, the evaluator
 * and the serializers cannot drift apart on what "pending" or "effective" means.
 */

type TVersionedVisibility = Readonly<{
  visibility: TSurveyVisibility;
  visibilityProjectedVersion: number;
  visibilityVersion: number;
}>;

/**
 * `visibilityProjectedVersion` of a survey no projection has ever been acknowledged for. An insert
 * writes it (the `survey_visibility_pending` trigger), so it is distinct from the settled `0/0` every
 * pre-migration survey carries: a survey at `-1` has no edges in the graph at all.
 */
export const SURVEY_VISIBILITY_NEVER_ACKNOWLEDGED = -1;

/** The graph does not hold this row's version: a stored change, or the initial projection, in flight. */
export const isAwaitingProjection = (row: Omit<TVersionedVisibility, "visibility">): boolean =>
  row.visibilityVersion !== row.visibilityProjectedVersion;

/** No projection of this survey was ever acknowledged, so its graph node has no edges yet. */
export const isNeverAcknowledged = (row: Pick<TVersionedVisibility, "visibilityProjectedVersion">): boolean =>
  row.visibilityProjectedVersion < 0;

/**
 * The initial projection: a survey inserted (created or copied) and not yet projected, whose visibility
 * was never changed — version `0`, as the contract has it for "never changed through the endpoint". It
 * is not a pending change: its stored value is what it has always been, so it is enforced as stored.
 */
export const isInitialProjection = (row: Omit<TVersionedVisibility, "visibility">): boolean =>
  row.visibilityVersion === 0 && isNeverAcknowledged(row);

/**
 * A change stored through the visibility endpoint that the graph has not acknowledged yet, in either
 * direction — the contract's `pending`. The initial projection is not one.
 */
export const isPending = (row: Omit<TVersionedVisibility, "visibility">): boolean =>
  isAwaitingProjection(row) && !isInitialProjection(row);

/**
 * What is enforced right now. Pending counts as restricted whichever way it points: a restriction takes
 * effect at once, and a grant only once the graph holds it (fail closed). During the initial projection
 * the stored value is enforced: it was never anything else, so there is nothing for it to overtake.
 */
export const getEffectiveVisibility = (row: TVersionedVisibility): TSurveyVisibility =>
  isPending(row) ? "restricted" : row.visibility;

/** The value a stored change is still waiting on, or `null` when nothing is in flight. */
export const getPendingVisibility = (row: TVersionedVisibility): TSurveyVisibility | null =>
  isPending(row) ? row.visibility : null;
