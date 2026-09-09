import { TSurvey } from "@formbricks/types/surveys/types";
import { isDeepEqual } from "@/lib/utils/object";

/** Stands in for `updatedAt` on both sides of a comparison, so its real value never decides one. */
const IGNORED_UPDATED_AT = new Date(0);

/**
 * `updatedAt` moves on every write and is never something the user typed, so it can't take part in a
 * dirty check. Flattened to a fixed value rather than stripped, which keeps the result a `TSurvey`.
 */
const ignoringUpdatedAt = (survey: TSurvey): TSurvey => ({ ...survey, updatedAt: IGNORED_UPDATED_AT });

/**
 * Whether the editor holds changes that are not persisted.
 *
 * A save leaves behind two representations of the same stored survey: the one the server action
 * returns, which `localSurvey` is set to, and the one the `router.refresh()` that follows re-reads
 * into the `survey` prop. They reach the client by different routes and do not always arrive
 * identical, so checking `localSurvey` against only one of them reports unsaved work the moment a
 * save completes. Pass every survey known to be persisted; the editor is clean when it matches any
 * of them, and the guard still fires on the first genuine edit, which matches none.
 */
export const hasUnsavedSurveyChanges = (
  localSurvey: TSurvey,
  persistedSurveys: readonly (TSurvey | null | undefined)[]
): boolean => {
  const local = ignoringUpdatedAt(localSurvey);
  return !persistedSurveys.some((persisted) => persisted && isDeepEqual(local, ignoringUpdatedAt(persisted)));
};
