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

/**
 * Whether the editor's "just saved" bypass of the unload warning still holds.
 *
 * A successful save sets that bypass so the navigation the user is already making is not interrupted
 * by a warning about the work that save just persisted. Only a new `survey` prop clears it again, and
 * an autosave does not produce one -- it writes its result into refs to avoid re-rendering the
 * editor. So after an autosave the bypass stays set indefinitely, and the next edit leaves the editor
 * dirty with its unload warning disabled: a reload discards that edit silently, including the one
 * offered by the stale-deployment prompt (ENG-2330).
 *
 * Unsaved changes are what the bypass exists to skip over, so their reappearance is what retires it.
 */
export const isJustSavedBypassValid = (hasJustSaved: boolean, hasUnsavedChanges: boolean): boolean =>
  hasJustSaved && !hasUnsavedChanges;
