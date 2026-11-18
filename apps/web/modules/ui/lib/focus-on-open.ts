/**
 * For a Radix dialog's or popover's `onOpenAutoFocus`: focus `target` instead of the first focusable
 * element, so it can open on its main field without the `autoFocus` attribute. Without a target (not
 * rendered), Radix's default focus is left alone rather than dropped.
 *
 * `onOpenAutoFocus={(event) => focusOnOpen(event, inputRef.current)}`
 */
export const focusOnOpen = (event: Event, target: HTMLElement | null | undefined): void => {
  if (!target) return;
  event.preventDefault();
  target.focus();
};
