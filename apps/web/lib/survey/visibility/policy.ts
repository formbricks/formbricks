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

/** A stored change the graph has not acknowledged yet, in either direction. */
export const isPending = (row: Omit<TVersionedVisibility, "visibility">): boolean =>
  row.visibilityVersion !== row.visibilityProjectedVersion;

/**
 * What is enforced right now. Pending counts as restricted whichever way it points: a restriction takes
 * effect at once, and a grant only once the graph holds it (fail closed).
 */
export const getEffectiveVisibility = (row: TVersionedVisibility): TSurveyVisibility =>
  isPending(row) ? "restricted" : row.visibility;

/** The value a stored change is still waiting on, or `null` when nothing is in flight. */
export const getPendingVisibility = (row: TVersionedVisibility): TSurveyVisibility | null =>
  isPending(row) ? row.visibility : null;
