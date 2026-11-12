import { TEditorIssue, getIssueFieldKey } from "./validation-issues";

// What a field is typed into. A rich text editor is a contenteditable; the rest are native inputs. The
// field's wrapper also holds controls that come earlier in the document but are not the field: the
// editor's toolbar buttons and the Required switch (a button with a hidden checkbox behind it).
const EDITABLE = "[contenteditable='true']";
const NATIVE_INPUT =
  "input:not([type='hidden']):not([type='file']):not([aria-hidden='true']):not([tabindex='-1']), textarea, select";
const FOCUSABLE = "button, [tabindex]:not([tabindex='-1'])";

const findFieldControl = (node: HTMLElement): HTMLElement | null =>
  node.matches(`${EDITABLE}, ${NATIVE_INPUT}`)
    ? node
    : (node.querySelector<HTMLElement>(EDITABLE) ??
      node.querySelector<HTMLElement>(NATIVE_INPUT) ??
      node.querySelector<HTMLElement>(FOCUSABLE));

// The live preview moves focus to its own first control when the question it shows changes, and jumping to a
// problem in another block changes it. For this long after a jump, focus that lands in the preview is handed
// back, unless the author has pressed a key or clicked in the meantime.
const PREVIEW_REFOCUS_WINDOW_MS = 1500;
const PREVIEW_CONTAINER_ID = "formbricks-survey-container";

const keepFocusOutOfPreview = (control: HTMLElement) => {
  const preview = document.getElementById(PREVIEW_CONTAINER_ID);
  if (!preview) return;

  const reclaim = (event: FocusEvent) => {
    if (event.target instanceof Node && preview.contains(event.target)) {
      control.focus({ preventScroll: true });
    }
  };
  const stop = () => {
    window.clearTimeout(timer);
    document.removeEventListener("focusin", reclaim, true);
    document.removeEventListener("pointerdown", stop, true);
    document.removeEventListener("keydown", stop, true);
  };
  const timer = window.setTimeout(stop, PREVIEW_REFOCUS_WINDOW_MS);

  document.addEventListener("focusin", reclaim, true);
  document.addEventListener("pointerdown", stop, true);
  document.addEventListener("keydown", stop, true);
};

// A tab switch or a card opening mounts its content within a frame or two; give up after this many.
const MAX_FRAMES = 20;

/**
 * Takes the author to an issue's field: focuses its input and scrolls it into view. The card may still be
 * mounting (the tab just changed, the question just opened), so this retries frame by frame rather than
 * guessing a delay, and falls back to the card itself when the field never appears.
 */
export const focusIssueTarget = ({ targetId, field }: Pick<TEditorIssue, "targetId" | "field">) => {
  if (typeof window === "undefined" || !targetId) return;

  let frames = 0;
  const attempt = () => {
    const fieldNode = field
      ? document.querySelector<HTMLElement>(
          `[data-issue-field="${CSS.escape(getIssueFieldKey(targetId, field))}"]`
        )
      : null;
    // A whole-card issue has no field to wait for; a field issue waits for its input to mount.
    // A block's row on the Flow tab is `flow-<block id>`; every other card or row carries its own id.
    const cardNode =
      !field || frames >= MAX_FRAMES
        ? (document.getElementById(targetId) ?? document.getElementById(`flow-${targetId}`))
        : null;
    const node = fieldNode ?? cardNode;

    if (node) {
      const focusable = findFieldControl(node);
      focusable?.focus({ preventScroll: true });
      if (focusable) keepFocusOutOfPreview(focusable);
      (focusable ?? node).scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    if (frames++ < MAX_FRAMES) requestAnimationFrame(attempt);
  };

  requestAnimationFrame(attempt);
};

/** For an issue with no card to land on: the open tab, so focus stays in the editor and not on the page body. */
export const focusActiveTab = () => {
  if (typeof window === "undefined") return;
  requestAnimationFrame(() => {
    document.querySelector<HTMLElement>('nav[aria-label="Tabs"] [aria-current="page"]')?.focus();
  });
};
