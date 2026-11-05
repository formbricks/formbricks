/** What the check reads off one element of a line that may be cut off. */
export interface TTextBox {
  scrollWidth: number;
  clientWidth: number;
  /** The element's computed `overflow-x`. */
  overflowX: string;
}

/**
 * Whether a line's text is cut off (ENG-6953 point 35, ENG-6969 T2): some element in it clips content
 * wider than its box, the way a `truncate` span does. Text that spills out visibly is not cut off, so
 * it gets no tooltip.
 *
 * It looks at every element rather than at marked ones, so a line opts in by being wrapped, whatever
 * renders inside it (a table's own column header, a rule summary's chips).
 */
export const isTextCutOff = (boxes: readonly TTextBox[]): boolean =>
  boxes.some(
    ({ scrollWidth, clientWidth, overflowX }) => overflowX !== "visible" && scrollWidth > clientWidth
  );

/** {@link isTextCutOff} for a line in the page: the element and everything inside it. */
export const isElementCutOff = (root: HTMLElement | null): boolean =>
  root !== null &&
  isTextCutOff(
    [root, ...Array.from(root.querySelectorAll<HTMLElement>("*"))].map((element) => ({
      scrollWidth: element.scrollWidth,
      clientWidth: element.clientWidth,
      overflowX: globalThis.getComputedStyle(element).overflowX,
    }))
  );
