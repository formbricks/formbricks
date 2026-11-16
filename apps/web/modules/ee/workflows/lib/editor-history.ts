import type { TWorkflowDefinition } from "@formbricks/workflows";

/**
 * Undo/redo for the workflow editor. The editor autosaves, so without undo a mistaken edit (a deleted
 * branch, an overwritten field) would be saved two seconds later with no way back. Only the definition
 * is tracked; the name and description have their own text fields with the browser's undo.
 */

/** Edits closer together than this are one undo step: typing a word, or dragging a node. */
export const HISTORY_COALESCE_MS = 800;
/** How many steps are kept. Older ones are dropped. */
export const HISTORY_LIMIT = 50;

export type TEditorHistory = {
  past: TWorkflowDefinition[];
  future: TWorkflowDefinition[];
  /** When the last step was recorded, to merge quick successive edits into it. */
  lastRecordedAt: number;
};

export const EMPTY_HISTORY: TEditorHistory = { past: [], future: [], lastRecordedAt: 0 };

/**
 * Records that the definition changed away from `previous`. A change within the coalesce window of the
 * last one extends that step instead of adding another, so one undo reverts a whole burst of typing.
 * Any new edit clears what could be redone.
 */
export const recordEdit = (
  history: TEditorHistory,
  previous: TWorkflowDefinition,
  now: number
): TEditorHistory => {
  const merges = history.past.length > 0 && now - history.lastRecordedAt < HISTORY_COALESCE_MS;
  const past = merges ? history.past : [...history.past, previous].slice(-HISTORY_LIMIT);
  return { past, future: [], lastRecordedAt: now };
};

/** Steps back: returns the definition to restore and the history after it, or null if nothing is left. */
export const undoStep = (
  history: TEditorHistory,
  current: TWorkflowDefinition
): { definition: TWorkflowDefinition; history: TEditorHistory } | null => {
  const definition = history.past.at(-1);
  if (!definition) return null;
  return {
    definition,
    history: { past: history.past.slice(0, -1), future: [current, ...history.future], lastRecordedAt: 0 },
  };
};

/** Steps forward again after an undo, or null if there is nothing to redo. */
export const redoStep = (
  history: TEditorHistory,
  current: TWorkflowDefinition
): { definition: TWorkflowDefinition; history: TEditorHistory } | null => {
  const [definition, ...future] = history.future;
  if (!definition) return null;
  return {
    definition,
    history: { past: [...history.past, current].slice(-HISTORY_LIMIT), future, lastRecordedAt: 0 },
  };
};

/**
 * Keyboard undo belongs to the field being typed in (text inputs, the JSON editor, rich text), so the
 * editor-level shortcut only applies when focus is elsewhere.
 */
export const isTypingTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.closest(".cm-editor") !== null;
};
