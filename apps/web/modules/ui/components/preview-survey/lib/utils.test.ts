import "@testing-library/jest-dom/vitest";
import { describe, expect, test } from "vitest";
import { getPlacementStyle } from "./utils";

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
    expect(style).toBe("top-1/2 left-1/2 transform !-translate-x-1/2 -translate-y-1/2");
  });

  test("returns default style for invalid placement", () => {
    // @ts-ignore - Testing with invalid input
    const style = getPlacementStyle("invalidPlacement");
    expect(style).toBe("bottom-3 sm:right-3");
  });
});
