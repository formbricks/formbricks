import { describe, expect, test } from "vitest";
import {
  AA_CONTRAST_RATIO,
  ensureReadable,
  getContrastRatio,
  getReadableTextColor,
  hexToRGBA,
  isLight,
  mixColor,
} from "./colors";

describe("Color utilities", () => {
  describe("hexToRGBA", () => {
    test("should convert hex to rgba", () => {
      expect(hexToRGBA("#000000", 1)).toBe("rgba(0, 0, 0, 1)");
      expect(hexToRGBA("#FFFFFF", 0.5)).toBe("rgba(255, 255, 255, 0.5)");
      expect(hexToRGBA("#FF0000", 0.8)).toBe("rgba(255, 0, 0, 0.8)");
    });

    test("should convert shorthand hex to rgba", () => {
      expect(hexToRGBA("#000", 1)).toBe("rgba(0, 0, 0, 1)");
      expect(hexToRGBA("#FFF", 0.5)).toBe("rgba(255, 255, 255, 0.5)");
      expect(hexToRGBA("#F00", 0.8)).toBe("rgba(255, 0, 0, 0.8)");
    });

    test("should handle hex without # prefix", () => {
      expect(hexToRGBA("000000", 1)).toBe("rgba(0, 0, 0, 1)");
      expect(hexToRGBA("FFFFFF", 0.5)).toBe("rgba(255, 255, 255, 0.5)");
    });

    test("should return undefined for undefined or empty input", () => {
      expect(hexToRGBA(undefined, 1)).toBeUndefined();
      expect(hexToRGBA("", 0.5)).toBeUndefined();
    });

    test("should return empty string for invalid hex", () => {
      expect(hexToRGBA("invalid", 1)).toBe("");
    });
  });

  describe("mixColor", () => {
    test("should mix two colors with given weight", () => {
      expect(mixColor("#000000", "#FFFFFF", 0.5)).toBe("#808080");
      expect(mixColor("#FF0000", "#0000FF", 0.5)).toBe("#800080");
      expect(mixColor("#FF0000", "#00FF00", 0.75)).toBe("#40bf00");
    });

    test("should handle edge cases", () => {
      expect(mixColor("#000000", "#FFFFFF", 0)).toBe("#000000");
      expect(mixColor("#000000", "#FFFFFF", 1)).toBe("#ffffff");
    });
  });

  describe("isLight", () => {
    test("should determine if a color is light", () => {
      expect(isLight("#FFFFFF")).toBe(true);
      expect(isLight("#EEEEEE")).toBe(true);
      expect(isLight("#FFFF00")).toBe(true);
    });

    test("should determine if a color is dark", () => {
      expect(isLight("#000000")).toBe(false);
      expect(isLight("#333333")).toBe(false);
      expect(isLight("#0000FF")).toBe(false);
    });

    test("should handle shorthand hex colors", () => {
      expect(isLight("#FFF")).toBe(true);
      expect(isLight("#000")).toBe(false);
      expect(isLight("#F00")).toBe(false);
    });

    test("should throw error for invalid colors", () => {
      expect(() => isLight("invalid-color")).toThrow("Invalid color");
      expect(() => isLight("#1")).toThrow("Invalid color");
    });
  });

  describe("getContrastRatio", () => {
    test("returns 21:1 for black on white and 1:1 for identical colors", () => {
      expect(getContrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 5);
      expect(getContrastRatio("#123456", "#123456")).toBeCloseTo(1, 5);
    });

    test("is symmetric", () => {
      expect(getContrastRatio("#ff0000", "#ffffff")).toBeCloseTo(getContrastRatio("#ffffff", "#ff0000"), 10);
    });
  });

  describe("getReadableTextColor", () => {
    test("prefers the softer slate tone when it clears AA", () => {
      expect(getReadableTextColor("#ffffff")).toBe("#0f172a");
      expect(getReadableTextColor("#1e40af")).toBe("#ffffff");
    });

    test("escalates to a pure pole when the soft tone falls short of AA", () => {
      // Pure red: slate-900 beats white but only reaches ~4.46:1, so it must escalate to black.
      expect(getReadableTextColor("#ff0000")).toBe("#000000");
      expect(getContrastRatio(getReadableTextColor("#ff0000"), "#ff0000")).toBeGreaterThanOrEqual(
        AA_CONTRAST_RATIO
      );
    });

    test("always returns an AA-compliant text color across representative surfaces", () => {
      // Mix of poles, saturated hues, and the mid-tones where black/white cross over near AA.
      const surfaces = ["#ffffff", "#000000", "#ff0000", "#00ff00", "#0000ff", "#7f7f7f", "#808080", "#f9a8c0", "#ffff00", "#1e40af"]; // prettier-ignore
      for (const surface of surfaces) {
        expect(getContrastRatio(getReadableTextColor(surface), surface)).toBeGreaterThanOrEqual(
          AA_CONTRAST_RATIO
        );
      }
    });
  });

  describe("ensureReadable", () => {
    test("returns the preferred color unchanged when it already clears AA", () => {
      expect(ensureReadable("#0f172a", "#ffffff")).toBe("#0f172a");
    });

    test("darkens a too-light color on a light surface until it clears AA", () => {
      const surface = "#ffffff";
      const preferred = "#cccccc"; // far below AA on white
      const result = ensureReadable(preferred, surface);
      expect(getContrastRatio(result, surface)).toBeGreaterThanOrEqual(AA_CONTRAST_RATIO);
    });
  });
});
