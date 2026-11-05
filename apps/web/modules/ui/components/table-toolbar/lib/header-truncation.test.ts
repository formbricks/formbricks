import { describe, expect, test } from "vitest";
import { isHeaderTextCutOff } from "./header-truncation";

/** One element of a header as the check sees it: how wide its content is, its box, its overflow. */
const box = (scrollWidth: number, clientWidth: number, overflowX: string) => ({
  scrollWidth,
  clientWidth,
  overflowX,
});

/**
 * Column headers (ENG-6953 point 35): the full header shows in a tooltip only while part of it is cut
 * off, whatever the column's own header renders.
 */
describe("isHeaderTextCutOff", () => {
  test("a header whose truncating title is wider than its box is cut off", () => {
    // The cell's wrapper, the header's flex row, and its `truncate` title.
    expect(
      isHeaderTextCutOff([box(200, 200, "visible"), box(200, 200, "visible"), box(380, 176, "hidden")])
    ).toBe(true);
  });

  test("a title that fits is not cut off", () => {
    expect(
      isHeaderTextCutOff([box(200, 200, "visible"), box(200, 200, "visible"), box(120, 176, "hidden")])
    ).toBe(false);
  });

  test("text that spills out visibly is not cut off: it can be read", () => {
    expect(isHeaderTextCutOff([box(200, 120, "visible"), box(200, 120, "visible")])).toBe(false);
  });

  test("an empty header is not cut off", () => {
    expect(isHeaderTextCutOff([])).toBe(false);
  });
});
