/**
 * Single-key shortcut that toggles a dashboard's edit mode: it enters edit mode, and from inside it
 * saves when there is something to save and cancels otherwise.
 */
export const EDIT_HOTKEY = "e";

export type TEditHotkeyAction = "enter" | "save" | "cancel";

interface EditHotkeyState {
  isReadOnly: boolean;
  isEditing: boolean;
  hasChanges: boolean;
  isSaving: boolean;
}

/**
 * What `E` does in the dashboard's current state, or `null` when it does nothing. A read-only viewer
 * has no edit mode; while a save is in flight the key stays quiet so it cannot cancel a half-written
 * layout or queue a second save.
 */
export const resolveEditHotkeyAction = ({
  isReadOnly,
  isEditing,
  hasChanges,
  isSaving,
}: EditHotkeyState): TEditHotkeyAction | null => {
  if (isReadOnly) return null;
  if (!isEditing) return "enter";
  if (isSaving) return null;
  return hasChanges ? "save" : "cancel";
};

const TYPING_TAGS = new Set(["INPUT", "TEXTAREA", "SELECT"]);

type HotkeyEvent = Pick<KeyboardEvent, "key" | "metaKey" | "ctrlKey" | "altKey" | "shiftKey"> & {
  isComposing?: boolean;
  target?: EventTarget | null;
};

/**
 * True for a bare `E` that is not part of typing. The shortcut has no modifier, so anything that
 * takes text - the dashboard's own name field included - has to keep the keystroke.
 */
export const isEditHotkey = (event: HotkeyEvent): boolean => {
  if (event.key.toLowerCase() !== EDIT_HOTKEY) return false;
  if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return false;
  if (event.isComposing) return false;

  const target = event.target as { tagName?: string; isContentEditable?: boolean } | null | undefined;
  if (!target) return true;

  return !TYPING_TAGS.has(target.tagName ?? "") && target.isContentEditable !== true;
};

/**
 * Whether a layer above the page owns the keyboard. Radix mounts dialog and menu content only
 * while it is open, so its presence in the document is the signal - the open state itself lives
 * inside the components that render them and is not reachable from the page.
 */
export const hasOpenOverlay = (): boolean =>
  document.querySelector('[role="dialog"],[role="menu"],[role="alertdialog"]') !== null;
