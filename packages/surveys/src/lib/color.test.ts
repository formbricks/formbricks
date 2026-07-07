import { describe, expect, test } from "vitest";
import { AA_CONTRAST_RATIO, ensureReadable, getContrastRatio, isLight, mixColor } from "./color";

describe("mixColor", () => {
  test("should mix a color with white", () => {
    expect(mixColor("#FF0000", "#FFFFFF", 0.5)).toBe("#ff8080"); // Red mixed with white
    expect(mixColor("#0000FF", "#FFFFFF", 0.5)).toBe("#8080ff"); // Blue mixed with white
    expect(mixColor("#00FF00", "#FFFFFF", 0.2)).toBe("#33ff33"); // Green mixed with white (less white)
  });

  test("should mix a color with black", () => {
    expect(mixColor("#FF0000", "#000000", 0.5)).toBe("#800000"); // Red mixed with black
    expect(mixColor("#FFFF00", "#000000", 0.5)).toBe("#808000"); // Yellow mixed with black
  });

  test("should return the first color if weight is 0", () => {
    expect(mixColor("#FF0000", "#00FF00", 0)).toBe("#ff0000");
  });

  test("should return the second color if weight is 1", () => {
    expect(mixColor("#FF0000", "#00FF00", 1)).toBe("#00ff00");
  });

  test("should handle shorthand hex codes", () => {
    expect(mixColor("#F00", "#0F0", 0.5)).toBe("#808000"); // Red and Green
    expect(mixColor("#00F", "#FFF", 0.5)).toBe("#8080ff"); // Blue and White
  });

  test("should handle hex codes without # prefix (implicitly handled by hexToRGBA regex)", () => {
    expect(mixColor("FF0000", "00FF00", 0.5)).toBe("#808000");
  });

  test("should default to black if one color is invalid/empty", () => {
    // hexToRGBA returns "" for invalid, which becomes [0,0,0] in mixColor
    expect(mixColor("invalidColor", "#FFFFFF", 0.5)).toBe("#808080"); // invalid (black) mixed with white
    expect(mixColor("#FF0000", "", 0.5)).toBe("#800000"); // Red mixed with empty (black)
    expect(mixColor("", "", 0.5)).toBe("#000000"); // Both empty (black)
  });

  test("should mix two distinct colors correctly", () => {
    expect(mixColor("#FF0000", "#0000FF", 0.5)).toBe("#800080"); // Red and Blue -> Purple
  });
});

describe("isLight", () => {
  test("should return true for light colors", () => {
    expect(isLight("#FFFFFF")).toBe(true); // White
    expect(isLight("#F0F0F0")).toBe(true); // Light gray
    expect(isLight("#FFD700")).toBe(true); // Gold
    expect(isLight("#FFF")).toBe(true); // Shorthand white
    expect(isLight("#ABC")).toBe(true); // Shorthand light color
  });

  test("should return false for dark colors", () => {
    expect(isLight("#000000")).toBe(false); // Black
    expect(isLight("#333333")).toBe(false); // Dark gray
    expect(isLight("#8B0000")).toBe(false); // Dark red
    expect(isLight("#000")).toBe(false); // Shorthand black
    expect(isLight("#123")).toBe(false); // Shorthand dark color
  });

  test("should handle colors near the threshold", () => {
    // Luminance of #808080 (gray) is 128. Formula: r*0.299 + g*0.587 + b*0.114 > 128
    // For #808080 (128,128,128): 128*0.299 + 128*0.587 + 128*0.114 = 128*1 = 128. So it's not > 128.
    expect(isLight("#808080")).toBe(false); // Gray (threshold case, should be false)
    expect(isLight("#818181")).toBe(true); // Slightly lighter than gray
    expect(isLight("#7F7F7F")).toBe(false); // Slightly darker than gray
  });

  test("should throw error for invalid color strings", () => {
    expect(() => isLight("#12345")).toThrow("Invalid color");
    expect(() => isLight("notacolor")).toThrow("Invalid color");
    expect(isLight("#GGHHII")).toBe(false); // Invalid hex characters currently return false
    expect(() => isLight("")).toThrow("Invalid color");
    expect(() => isLight("#12")).toThrow("Invalid color"); // Too short
  });
});

describe("getContrastRatio", () => {
  test("returns 21:1 for black on white and 1:1 for identical colors", () => {
    expect(getContrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 5);
    expect(getContrastRatio("#123456", "#123456")).toBeCloseTo(1, 5);
  });
});

describe("ensureReadable", () => {
  test("returns the preferred color unchanged when it already clears AA", () => {
    expect(ensureReadable("#1e40af", "#ffffff")).toBe("#1e40af");
  });

  test("darkens a too-light color on a light surface until it clears AA", () => {
    const result = ensureReadable("#f9a8c0", "#ffffff"); // light pink fails as text on white
    expect(result).not.toBe("#f9a8c0");
    expect(getContrastRatio(result, "#ffffff")).toBeGreaterThanOrEqual(AA_CONTRAST_RATIO);
  });

  test("produces an AA-compliant result against white for any brand color", () => {
    for (let r = 0; r <= 255; r += 51) {
      for (let g = 0; g <= 255; g += 51) {
        for (let b = 0; b <= 255; b += 51) {
          const brand = "#" + [r, g, b].map((x) => x.toString(16).padStart(2, "0")).join("");
          expect(getContrastRatio(ensureReadable(brand, "#ffffff"), "#ffffff")).toBeGreaterThanOrEqual(
            AA_CONTRAST_RATIO
          );
        }
      }
    }
  });
});
