import { TSurvey } from "@formbricks/types/surveys/types";
import { isDeepEqual } from "@/lib/utils/object";

/**
 * `updatedAt` moves on every write and is never something the user typed, so it can't take part in a
 * dirty check.
 */
const withoutUpdatedAt = (survey: TSurvey): Omit<TSurvey, "updatedAt"> => {
  const { updatedAt: _updatedAt, ...rest } = survey;
  return rest;
};

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
  const local = withoutUpdatedAt(localSurvey);
  return !persistedSurveys.some((persisted) => persisted && isDeepEqual(local, withoutUpdatedAt(persisted)));
};
