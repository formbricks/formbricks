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
 * No projection of this survey was ever acknowledged (`visibilityProjectedVersion` is 0): a survey just
 * created or copied, or a pre-existing one whose first visibility change is still in flight.
 */
export const isNeverProjected = (row: Pick<TVersionedVisibility, "visibilityProjectedVersion">): boolean =>
  row.visibilityProjectedVersion === 0;

/**
 * What is enforced right now. Pending counts as restricted whichever way it points: a restriction takes
 * effect at once, and a grant only once the graph holds it (fail closed).
 *
 * Except before the first acknowledged projection: then the stored value is enforced. That only differs
 * for a stored `workspace` — a restriction is `restricted` either way — and no acknowledged state exists
 * for such a grant to overtake, so a new survey is not held back as restricted until the outbox drains.
 */
export const getEffectiveVisibility = (row: TVersionedVisibility): TSurveyVisibility =>
  isPending(row) && !isNeverProjected(row) ? "restricted" : row.visibility;

/** The value a stored change is still waiting on, or `null` when nothing is in flight. */
export const getPendingVisibility = (row: TVersionedVisibility): TSurveyVisibility | null =>
  isPending(row) ? row.visibility : null;
