import "@testing-library/jest-dom/vitest";
import { describe, expect, test } from "vitest";
import { getPlacementStyle, mirrorPlacementForDir } from "./utils";

describe("getPlacementStyle", () => {
  test("returns correct style for bottomRight placement", () => {
    const style = getPlacementStyle("bottomRight");
    expect(style).toBe("bottom-3 sm:right-3");
  });

  test("returns correct style for topRight placement", () => {
    const style = getPlacementStyle("topRight");
    expect(style).toBe("sm:top-6 sm:right-6");
  });

  test("returns correct style for topLeft placement", () => {
    const style = getPlacementStyle("topLeft");
    expect(style).toBe("sm:top-6 sm:left-6");
  });

  test("returns correct style for bottomLeft placement", () => {
    const style = getPlacementStyle("bottomLeft");
    expect(style).toBe("bottom-3 sm:left-3");
  });

  test("returns correct style for center placement", () => {
    const style = getPlacementStyle("center");
    expect(style).toBe("top-1/2 left-1/2 transform -translate-x-1/2! -translate-y-1/2");
  });

  test("returns default style for invalid placement", () => {
    // @ts-ignore - Testing with invalid input
    const style = getPlacementStyle("invalidPlacement");
    expect(style).toBe("bottom-3 sm:right-3");
  });
});

describe("mirrorPlacementForDir", () => {
  test("mirrors the horizontal side of every corner placement in RTL", () => {
    expect(mirrorPlacementForDir("bottomRight", "rtl")).toBe("bottomLeft");
    expect(mirrorPlacementForDir("bottomLeft", "rtl")).toBe("bottomRight");
    expect(mirrorPlacementForDir("topRight", "rtl")).toBe("topLeft");
    expect(mirrorPlacementForDir("topLeft", "rtl")).toBe("topRight");
  });

  test("leaves center untouched in RTL — it has no side to flip", () => {
    expect(mirrorPlacementForDir("center", "rtl")).toBe("center");
  });

  test("returns the authored placement unchanged for ltr and auto", () => {
    expect(mirrorPlacementForDir("bottomRight", "ltr")).toBe("bottomRight");
    expect(mirrorPlacementForDir("topLeft", "ltr")).toBe("topLeft");
    expect(mirrorPlacementForDir("bottomRight", "auto")).toBe("bottomRight");
  });

  test("is its own inverse, so switching the preview back to an LTR language restores the corner", () => {
    const placements = ["bottomRight", "bottomLeft", "topRight", "topLeft", "center"] as const;
    for (const placement of placements) {
      expect(mirrorPlacementForDir(mirrorPlacementForDir(placement, "rtl"), "rtl")).toBe(placement);
    }
  });
});
