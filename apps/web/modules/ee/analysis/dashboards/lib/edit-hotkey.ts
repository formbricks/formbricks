/** Single-key shortcut that puts a dashboard into edit mode. */
export const EDIT_HOTKEY = "e";

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
