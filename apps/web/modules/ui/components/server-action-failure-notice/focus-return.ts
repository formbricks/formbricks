/**
 * Hands keyboard focus back to where it came from when a transient surface -- the server-action failure
 * notice -- goes away (ENG-2899). Without it, closing the notice from the keyboard unmounts the focused
 * button and drops focus to the document body, so a keyboard user starts over from the top of the page.
 *
 * The origin outlives the surface itself: a new failure remounts the notice and moves focus into the
 * new one, and focus must still return to where it was before the first.
 */
export interface FocusReturn {
  /** Call when focus enters the surface, with the event's `relatedTarget` (where it came from). */
  recordEntry: (from: EventTarget | null) => void;
  /** Call as the surface is dismissed, with the element that has focus at that moment. */
  restore: (focused: Element | null) => void;
}

export const createFocusReturn = (isInside: (element: Element) => boolean): FocusReturn => {
  let origin: HTMLElement | null = null;

  return {
    recordEntry: (from) => {
      // Focus moving within the surface, or into a remounted one, keeps the original origin.
      if (from instanceof HTMLElement && !isInside(from)) origin = from;
    },
    restore: (focused) => {
      const returnTo = origin;
      origin = null;
      // Only when focus is still in the surface: a dismissal by mouse leaves focus wherever it already
      // is. An origin removed since (its dialog closed) is fine: focusing a detached element is a no-op.
      if (focused !== null && isInside(focused)) returnTo?.focus();
    },
  };
};
