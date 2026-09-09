import { describe, expect, test } from "vitest";
import { getSkeletonWidthPercent } from "./skeleton-width";

describe("getSkeletonWidthPercent", () => {
  // The shapes React has used for `useId()` across versions, so the spread property below is not
  // pinned to one of them.
  const ID_FORMATS = [
    (index: number) => `«r${index}»`,
    (index: number) => `_r_${index}_`,
    (index: number) => `:r${index}:`,
  ];

  test("stays within the 50%-90% range", () => {
    const widths = ID_FORMATS.flatMap((format) =>
      Array.from({ length: 40 }, (_, index) => getSkeletonWidthPercent(format(index)))
    );

    for (const width of widths) {
      expect(width).toBeGreaterThanOrEqual(50);
      expect(width).toBeLessThanOrEqual(90);
    }
  });

  test("is stable for the same id", () => {
    // The whole reason this is derived from useId() rather than Math.random(): the server pass and
    // hydration must agree on the width.
    expect(getSkeletonWidthPercent("«r7»")).toBe(getSkeletonWidthPercent("«r7»"));
  });

  test("spreads consecutive ids across the range", () => {
    // Guards the mixing step. Simplifying the hash to a plain sum of code points still passes the
    // range and stability tests above, but steps consecutive widths by 1% — rows that look
    // identical, which is the bug this whole helper exists to avoid.
    for (const format of ID_FORMATS) {
      const widths = Array.from({ length: 8 }, (_, index) => getSkeletonWidthPercent(format(index)));
      const gaps = widths.slice(1).map((width, index) => Math.abs(width - widths[index]));
      const meanGap = gaps.reduce((total, gap) => total + gap, 0) / gaps.length;

      expect(meanGap).toBeGreaterThan(5);
    }
  });

  test("returns a width for an empty id", () => {
    expect(getSkeletonWidthPercent("")).toBe(50);
  });
});
