import { describe, expect, test, vi } from "vitest";
import { hexToRGBA, isLight, mixColor } from "./colors";

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
});
