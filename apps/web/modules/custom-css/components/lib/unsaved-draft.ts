import { type TCustomCssInput } from "@formbricks/types/custom-css";
import { type TCustomCssDraft, getCustomCssChangeKind } from "./draft";

/**
 * Unsaved workspace CSS drafts, kept in memory for as long as the dashboard stays loaded.
 *
 * The App Router cannot block in-app navigation (see `useBeforeUnloadPrompt`), so leaving Appearance
 * through a link would drop a pasted stylesheet. The card keeps its draft here instead and picks it up
 * again when it loads. Memory, not browser storage: nothing outlives the tab or a sign-out (which
 * reloads the page), and a reload or a full navigation is covered by the browser's leave prompt.
 */
interface TKeptDraft {
  /** The saved CSS the draft was edited from. */
  base: TCustomCssInput | null;
  draft: TCustomCssDraft;
}

const keptDrafts = new Map<string, TKeptDraft>();

/** Keeps `draft` while it differs from `saved`, the CSS it was edited from; forgets it otherwise. */
export const keepUnsavedWorkspaceCssDraft = (
  workspaceId: string,
  saved: TCustomCssInput | null,
  draft: TCustomCssDraft | null
): void => {
  if (draft === null || getCustomCssChangeKind(saved, draft) === "unchanged") {
    keptDrafts.delete(workspaceId);
    return;
  }
  keptDrafts.set(workspaceId, { base: saved, draft });
};

/**
 * The kept draft, as long as the CSS it was edited from is still the saved CSS: once something else has
 * been saved, offering it back would quietly undo that save on the next "Save". Read during render, so
 * it never changes what is kept.
 */
export const getUnsavedWorkspaceCssDraft = (
  workspaceId: string,
  saved: TCustomCssInput | null
): TCustomCssDraft | null => {
  const kept = keptDrafts.get(workspaceId);
  if (
    !kept ||
    getCustomCssChangeKind(kept.base, saved) !== "unchanged" ||
    getCustomCssChangeKind(saved, kept.draft) === "unchanged"
  ) {
    return null;
  }
  return kept.draft;
};
