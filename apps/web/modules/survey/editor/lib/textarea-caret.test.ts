// @vitest-environment jsdom
import { afterEach, describe, expect, test, vi } from "vitest";
import { getCaretCoordinates } from "./textarea-caret";

/**
 * jsdom lays nothing out, so the marker's offsets are stubbed: they stand for where the browser draws
 * the text before the caret in the mirror. What is under test is everything around that measurement.
 */
const stubMarkerOffsets = (top: number, left: number) => {
  const seen: { mirrorText: string; markerText: string; whiteSpace: string }[] = [];
  vi.spyOn(HTMLElement.prototype, "offsetTop", "get").mockImplementation(function (this: HTMLElement) {
    const mirror = this.parentElement;
    if (mirror) {
      seen.push({
        mirrorText: mirror.firstChild?.textContent ?? "",
        markerText: this.textContent ?? "",
        whiteSpace: mirror.style.whiteSpace,
      });
    }
    return top;
  });
  vi.spyOn(HTMLElement.prototype, "offsetLeft", "get").mockReturnValue(left);
  return seen;
};

const textarea = (value: string) => {
  const element = document.createElement("textarea");
  element.value = value;
  element.style.borderTopWidth = "2px";
  element.style.borderLeftWidth = "3px";
  element.style.borderStyle = "solid";
  element.style.lineHeight = "20px";
  document.body.appendChild(element);
  return element;
};

afterEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = "";
});

describe("getCaretCoordinates", () => {
  test("lays out the text before the caret, with the rest after the marker so wrapping matches", () => {
    const seen = stubMarkerOffsets(0, 0);
    getCaretCoordinates(textarea("round(@q1 * 20)"), 7);

    expect(seen[0]).toEqual({ mirrorText: "round(@", markerText: "q1 * 20)", whiteSpace: "pre-wrap" });
  });

  test("at the end of the text the marker still has a line to sit on", () => {
    const seen = stubMarkerOffsets(0, 0);
    getCaretCoordinates(textarea("1 + @"), 5);

    expect(seen[0]).toMatchObject({ mirrorText: "1 + @", markerText: "." });
  });

  test("adds the textarea's border and takes off its scroll, giving the line's height", () => {
    stubMarkerOffsets(40, 50);
    const element = textarea("a\nb\nc\nd");
    element.scrollTop = 15;
    element.scrollLeft = 4;

    expect(getCaretCoordinates(element, 6)).toEqual({ top: 40 + 2 - 15, left: 50 + 3 - 4, height: 20 });
  });

  test("leaves nothing behind in the page", () => {
    stubMarkerOffsets(0, 0);
    const element = textarea("@");
    getCaretCoordinates(element, 1);

    expect(document.body.children).toHaveLength(1);
    expect(document.body.firstElementChild).toBe(element);
  });
});
