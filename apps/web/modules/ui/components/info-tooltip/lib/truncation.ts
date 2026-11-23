/** What the check reads off one element of a line that may be cut off. */
export interface TTextBox {
  scrollWidth: number;
  clientWidth: number;
  /** The element's computed `overflow-x`. */
  overflowX: string;
  /** Read for text clamped to a number of lines (`line-clamp-2`): cut off at the bottom, not the side. */
  scrollHeight?: number;
  clientHeight?: number;
  /** The element's computed `overflow-y`. */
  overflowY?: string;
}

// A line's descenders can make its content a pixel taller than its box without hiding anything.
const HEIGHT_TOLERANCE_PX = 1;

const isClippedSideways = ({ scrollWidth, clientWidth, overflowX }: TTextBox) =>
  overflowX !== "visible" && scrollWidth > clientWidth;

const isClippedAtTheBottom = ({ scrollHeight, clientHeight, overflowY }: TTextBox) =>
  overflowY !== undefined &&
  overflowY !== "visible" &&
  scrollHeight !== undefined &&
  clientHeight !== undefined &&
  scrollHeight > clientHeight + HEIGHT_TOLERANCE_PX;

/**
 * Whether a line's text is cut off (ENG-6953 point 35, ENG-6969 T2): some element in it clips content
 * wider than its box, the way a `truncate` span does, or taller than its box, the way text clamped to a
 * few lines is. Text that spills out visibly is not cut off, so it gets no tooltip.
 *
 * It looks at every element rather than at marked ones, so a line opts in by being wrapped, whatever
 * renders inside it (a table's own column header, a rule summary's chips).
 */
export const isTextCutOff = (boxes: readonly TTextBox[]): boolean =>
  boxes.some((box) => isClippedSideways(box) || isClippedAtTheBottom(box));

/** {@link isTextCutOff} for a line in the page: the element and everything inside it. */
export const isElementCutOff = (root: HTMLElement | null): boolean =>
  root !== null &&
  isTextCutOff(
    [root, ...Array.from(root.querySelectorAll<HTMLElement>("*"))].map((element) => {
      const style = globalThis.getComputedStyle(element);
      return {
        scrollWidth: element.scrollWidth,
        clientWidth: element.clientWidth,
        overflowX: style.overflowX,
        scrollHeight: element.scrollHeight,
        clientHeight: element.clientHeight,
        overflowY: style.overflowY,
      };
    })
  );
