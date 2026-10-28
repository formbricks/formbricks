import { describe, expect, test } from "vitest";
import {
  barShapePath,
  chooseBarOrientation,
  estimateTextWidth,
  labelFits,
  layoutBands,
  placeEndLabels,
  selectTickIndices,
  seriesAtOffset,
  truncateLabel,
  wrapLabel,
} from "./layout";

describe("truncateLabel", () => {
  test("leaves a label that fits and cuts one that does not", () => {
    expect(truncateLabel("Short", 200)).toBe("Short");
    const cut = truncateLabel("A very long question label that cannot fit", 80);
    expect(cut.endsWith("…")).toBe(true);
    expect(estimateTextWidth(cut)).toBeLessThanOrEqual(80 + 12);
  });
});

describe("chooseBarOrientation", () => {
  test("short labels in a wide plot read as columns", () => {
    expect(chooseBarOrientation(["Q1", "Q2", "Q3"], 480)).toBe("vertical");
  });

  test("long labels or many categories read as rows", () => {
    expect(chooseBarOrientation(["How easy was it to find what you needed?", "Overall"], 320)).toBe(
      "horizontal"
    );
    expect(
      chooseBarOrientation(
        Array.from({ length: 20 }, (_, i) => `Item ${i}`),
        480
      )
    ).toBe("horizontal");
  });
});

describe("layoutBands", () => {
  test("caps the bar at 24px and centres it in the slot", () => {
    const layout = layoutBands(600, 3, 1);
    expect(layout.band).toBe(200);
    expect(layout.thickness).toBe(24);
    expect(layout.offsets[0]).toBe(88);
  });

  test("shrinks bars of a crowded slot and keeps a 2px gap between series", () => {
    const layout = layoutBands(300, 10, 3);
    expect(layout.offsets[1] - layout.offsets[0]).toBeCloseTo(layout.thickness + 2, 5);
    expect(layout.thickness).toBeLessThan(24);
    expect(layout.thickness).toBeGreaterThanOrEqual(1);
  });
});

describe("barShapePath", () => {
  test("rounds the data end and squares the baseline", () => {
    const up = barShapePath(10, 20, 24, 80, "up");
    expect(up.startsWith("M10,100")).toBe(true);
    expect(up).toContain("Q10,20 14,20");
    expect(up.endsWith("V100 Z")).toBe(true);
  });

  test("clamps the radius to a bar thinner than the radius", () => {
    expect(barShapePath(0, 0, 4, 2, "right")).not.toContain("NaN");
    expect(barShapePath(0, 0, 0, 0, "down")).not.toContain("NaN");
  });

  test("covers all four directions", () => {
    for (const direction of ["up", "down", "left", "right"] as const) {
      expect(barShapePath(0, 0, 20, 30, direction)).toMatch(/^M.*Z$/);
    }
  });
});

describe("selectTickIndices", () => {
  test("labels every point when they fit, otherwise every nth starting at the first", () => {
    expect(selectTickIndices(4, 6)).toEqual([0, 1, 2, 3]);
    expect(selectTickIndices(10, 4)).toEqual([0, 3, 6, 9]);
    expect(selectTickIndices(0, 4)).toEqual([]);
    expect(selectTickIndices(5, 0)).toEqual([0]);
  });
});

describe("placeEndLabels", () => {
  test("drops a label that would touch another instead of nudging it", () => {
    const placed = placeEndLabels([
      { id: "a", y: 100 },
      { id: "b", y: 104 },
      { id: "c", y: 150 },
    ]);
    expect([...placed].sort()).toEqual(["a", "c"]);
  });
});

describe("labelFits", () => {
  test("needs padding on both sides", () => {
    expect(labelFits(30, 42)).toBe(true);
    expect(labelFits(30, 41)).toBe(false);
  });
});

describe("seriesAtOffset", () => {
  test("picks the bar nearest to the position, including a click in the gap or the margin", () => {
    const layout = layoutBands(300, 3, 2);
    expect(seriesAtOffset(layout, layout.offsets[0] + 1)).toBe(0);
    expect(seriesAtOffset(layout, layout.offsets[1] + 1)).toBe(1);
    expect(seriesAtOffset(layout, 0)).toBe(0);
    expect(seriesAtOffset(layout, layout.band)).toBe(1);
  });
});

describe("wrapLabel", () => {
  test("keeps a short label on one line", () => {
    expect(wrapLabel("Overall", 200)).toEqual(["Overall"]);
  });

  test("wraps at word boundaries and cuts the last line with an ellipsis", () => {
    const lines = wrapLabel("How likely are you to recommend us to a friend or colleague?", 150, 2, 11);
    expect(lines).toHaveLength(2);
    expect(lines[0]).toBe("How likely are you to");
    expect(lines[1].endsWith("…")).toBe(true);
  });

  test("breaks a single word longer than the line", () => {
    expect(wrapLabel("Supercalifragilisticexpialidocious", 80, 2, 11)[0].endsWith("…")).toBe(true);
  });

  test("an empty label stays one empty line", () => {
    expect(wrapLabel("   ", 80)).toEqual([""]);
  });
});
