import { TSurvey } from "@formbricks/types/surveys/types";
import { isDeepEqual } from "@/lib/utils/object";

/** Stands in for `updatedAt` on both sides of a comparison, so its real value never decides one. */
const IGNORED_UPDATED_AT = new Date(0);

/** Stands in for the legacy columns, which the server derives rather than the author editing them. */
const IGNORED_LEGACY_COLUMNS = {
  variables: [],
  hiddenFields: { enabled: false, fieldIds: [] },
} as const satisfies Pick<TSurvey, "variables" | "hiddenFields">;

/**
 * The survey with everything the server owns flattened to a fixed shape, so a dirty check is decided
 * only by what the author can actually change. Flattened rather than stripped, which keeps the
 * result a `TSurvey`.
 *
 * Three things here are not the author's:
 * - `updatedAt` moves on every write and is never something the user typed.
 * - `variables` / `hiddenFields` are **derived server-side** from `embeddedFields` (ENG-2628). The
 *   editor forwards whatever it was loaded with at mount and no longer recomputes them — nothing in
 *   the editor writes either key — so a card edit leaves them stale by design while the saved survey
 *   comes back carrying the derived ones.
 * - `field.id` is assigned when a row is first written, so a field the cards just added carries no
 *   id until the save returns.
 *
 * The last two are why this cannot be left to a plain deep equal. `isDeepEqual` fails on a differing
 * key count alone, and the draft auto-save deliberately updates its refs rather than `localSurvey`,
 * to avoid re-rendering the editor mid-typing. So without this, adding a field leaves the editor
 * permanently dirty: the auto-save re-saves the whole survey every tick, and the discard dialog and
 * the beforeunload prompt both fire on a survey that is fully saved.
 *
 * Only ids are dropped from `embeddedFields` — a rename, a retype or a reordered list all still read
 * as the unsaved edits they are.
 */
const ignoringServerOwned = (survey: TSurvey): TSurvey => ({
  ...survey,
  ...IGNORED_LEGACY_COLUMNS,
  updatedAt: IGNORED_UPDATED_AT,
  embeddedFields: survey.embeddedFields?.map(({ field: { id: _id, ...field }, link }) => ({ field, link })),
});

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
  const local = ignoringServerOwned(localSurvey);
  return !persistedSurveys.some(
    (persisted) => persisted && isDeepEqual(local, ignoringServerOwned(persisted))
  );
};
