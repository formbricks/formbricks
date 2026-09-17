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
 * The keys a save rewrites server-side, so the working copy has to adopt them back.
 *
 * A draft auto-save deliberately does not replace `localSurvey` with the server's return — that
 * would re-render the editor under the author's cursor every ten seconds. It stores the return in
 * `lastSavedSurveyRef` instead and compares against it. That works only while the return is
 * key-for-key what was sent: any key the server rewrites is a difference the working copy can never
 * reach on its own, so {@link hasUnsavedSurveyChanges} reports dirty on every tick and the editor
 * saves forever, with no user edit behind it.
 *
 * `segment` was the first such key (a private segment the server deletes when a survey switches
 * from app to link) and was patched in place. The Embedded Data rows added three more, and they are
 * the reason this is a list rather than a special case: `embeddedFields` comes back from a re-read
 * taken *after* the reconcile, carrying the row `id`, library `key`, `locked` and minted storage
 * keys the payload could not know (ENG-3228), while `variables` and `hiddenFields` are no longer
 * sent at all — the server derives both from those rows (`toLegacyEmbeddedFields`, ENG-2628) and
 * the editor forwards whatever it was mounted with.
 */
const SERVER_OWNED_KEYS = ["segment", "embeddedFields", "variables", "hiddenFields"] as const;

/**
 * The server-owned keys whose saved value differs from the working copy, or `null` when none does.
 *
 * Returned as a patch rather than applied here so the caller decides when it is safe to take it —
 * adopting a value into a working copy the author has edited since the request went out would drop
 * that edit.
 */
export const serverOwnedChanges = (localSurvey: TSurvey, savedSurvey: TSurvey): Partial<TSurvey> | null => {
  const changed = SERVER_OWNED_KEYS.filter((key) => !isDeepEqual(localSurvey[key], savedSurvey[key]));
  if (changed.length === 0) return null;

  return Object.fromEntries(changed.map((key) => [key, savedSurvey[key]]));
};
