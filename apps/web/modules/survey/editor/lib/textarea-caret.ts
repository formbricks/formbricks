/**
 * Where a character position of a textarea is drawn, relative to the textarea's top-left border
 * corner: the formula box (ENG-6935) opens its `@` menu there rather than at the box's edge.
 *
 * A textarea doesn't say where its caret is, so this lays the same text out in an invisible copy of
 * the box (a "mirror" div with the textarea's font, padding, border and wrapping) and measures a
 * marker placed at the position. The textarea's own scroll is then taken off.
 */

/** The styles that decide where text wraps and lines sit. */
const MIRRORED_PROPERTIES = [
  "direction",
  "boxSizing",
  "width",
  "height",
  "overflowX",
  "overflowY",
  "borderTopWidth",
  "borderRightWidth",
  "borderBottomWidth",
  "borderLeftWidth",
  "borderStyle",
  "paddingTop",
  "paddingRight",
  "paddingBottom",
  "paddingLeft",
  "fontStyle",
  "fontVariant",
  "fontWeight",
  "fontStretch",
  "fontSize",
  "fontSizeAdjust",
  "lineHeight",
  "fontFamily",
  "textAlign",
  "textTransform",
  "textIndent",
  "textDecoration",
  "letterSpacing",
  "wordSpacing",
  "tabSize",
] as const;

export interface TCaretCoordinates {
  top: number;
  left: number;
  /** The height of the line the caret is on. */
  height: number;
}

const px = (value: string): number => {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

export const getCaretCoordinates = (textarea: HTMLTextAreaElement, position: number): TCaretCoordinates => {
  const document = textarea.ownerDocument;
  const computed = document.defaultView?.getComputedStyle(textarea);
  const mirror = document.createElement("div");
  const style = mirror.style;

  style.position = "absolute";
  style.visibility = "hidden";
  style.top = "0";
  style.left = "-9999px";
  style.whiteSpace = "pre-wrap";
  style.overflowWrap = "break-word";
  if (computed) {
    for (const property of MIRRORED_PROPERTIES) style[property] = computed[property];
  }
  // The mirror never scrolls: the textarea's scroll is taken off below.
  style.overflow = "hidden";

  mirror.textContent = textarea.value.slice(0, position);
  const marker = document.createElement("span");
  // The rest of the text keeps the marker where wrapping puts it; "." gives it a height at the end.
  marker.textContent = textarea.value.slice(position) || ".";
  mirror.appendChild(marker);
  document.body.appendChild(mirror);

  const lineHeight = px(computed?.lineHeight ?? "") || px(computed?.fontSize ?? "") * 1.2;
  const coordinates: TCaretCoordinates = {
    top: marker.offsetTop + px(computed?.borderTopWidth ?? "") - textarea.scrollTop,
    left: marker.offsetLeft + px(computed?.borderLeftWidth ?? "") - textarea.scrollLeft,
    height: lineHeight,
  };
  mirror.remove();
  return coordinates;
};
