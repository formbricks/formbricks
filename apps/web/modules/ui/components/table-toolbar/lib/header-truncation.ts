/** What the check reads off one element of a column header. */
export interface THeaderBox {
  scrollWidth: number;
  clientWidth: number;
  /** The element's computed `overflow-x`. */
  overflowX: string;
}

/**
 * Whether a column header's text is cut off (ENG-6953 point 35): some element in it clips content
 * wider than its box, the way a `truncate` title does. Text that spills out visibly is not cut off,
 * so it gets no tooltip.
 *
 * It looks at every element rather than at a marked one because each table renders its own headers,
 * and the check sits in the shared header cell: no header has to opt in.
 */
export const isHeaderTextCutOff = (boxes: readonly THeaderBox[]): boolean =>
  boxes.some(
    ({ scrollWidth, clientWidth, overflowX }) => overflowX !== "visible" && scrollWidth > clientWidth
  );

/** {@link isHeaderTextCutOff} for a header in the page: the element and everything inside it. */
export const isHeaderElementCutOff = (root: HTMLElement | null): boolean =>
  root !== null &&
  isHeaderTextCutOff(
    [root, ...Array.from(root.querySelectorAll<HTMLElement>("*"))].map((element) => ({
      scrollWidth: element.scrollWidth,
      clientWidth: element.clientWidth,
      overflowX: globalThis.getComputedStyle(element).overflowX,
    }))
  );
