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
 * The pair an insert leaves (version 1, nothing acknowledged): a survey just created or copied whose
 * visibility has never changed. Exactly that pair, not any row with nothing acknowledged: a survey that
 * was changed before its first acknowledgement (created restricted, then granted) is at version 2, and a
 * pre-migration survey (0/0, settled) whose first change is in flight is a restriction at 1/0 — so a
 * *stored workspace* with this pair can only be a survey inserted workspace-visible and never touched.
 */
export const isNeverProjected = (
  row: Pick<TVersionedVisibility, "visibilityProjectedVersion" | "visibilityVersion">
): boolean => row.visibilityVersion === 1 && row.visibilityProjectedVersion === 0;

/**
 * What is enforced right now. Pending counts as restricted whichever way it points: a restriction takes
 * effect at once, and a grant only once the graph holds it (fail closed).
 *
 * Except a never-projected survey (see `isNeverProjected`): its stored value is enforced. That only
 * differs for a stored `workspace`, which then was never anything else — nothing was ever restricted
 * for it to release — so a new survey is not held back as restricted until the outbox drains.
 */
export const getEffectiveVisibility = (row: TVersionedVisibility): TSurveyVisibility =>
  isPending(row) && !isNeverProjected(row) ? "restricted" : row.visibility;

/** The value a stored change is still waiting on, or `null` when nothing is in flight. */
export const getPendingVisibility = (row: TVersionedVisibility): TSurveyVisibility | null =>
  isPending(row) ? row.visibility : null;
