import { describe, expect, test } from "vitest";
import {
  CATEGORICAL_DARK,
  CATEGORICAL_LIGHT,
  contrastRatio,
  labelColorOn,
  paletteFor,
  seriesColorVar,
} from "./palette";

describe("categorical palette", () => {
  test("has eight distinct hues per theme, in the validated order", () => {
    expect(CATEGORICAL_LIGHT).toHaveLength(8);
    expect(CATEGORICAL_DARK).toHaveLength(8);
    expect(new Set(CATEGORICAL_LIGHT).size).toBe(8);
    expect(new Set(CATEGORICAL_DARK).size).toBe(8);
    expect(CATEGORICAL_LIGHT.slice(0, 3)).toEqual(["#2a78d6", "#eb6834", "#1baf7a"]);
  });

  test("every hex is a six digit colour", () => {
    for (const hex of [...CATEGORICAL_LIGHT, ...CATEGORICAL_DARK]) {
      expect(hex).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  test("series slots map to CSS variables 1 to 8", () => {
    expect(seriesColorVar(0)).toBe("var(--fbc-s1)");
    expect(seriesColorVar(7)).toBe("var(--fbc-s8)");
  });

  test("paletteFor follows the theme", () => {
    expect(paletteFor("dark")).toBe(CATEGORICAL_DARK);
    expect(paletteFor("light")).toBe(CATEGORICAL_LIGHT);
  });
});

describe("label colour on a fill", () => {
  test("contrast ratio is symmetric and spans 1 to 21", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 0);
    expect(contrastRatio("#ffffff", "#ffffff")).toBeCloseTo(1, 5);
    expect(contrastRatio("#2a78d6", "#ffffff")).toBeCloseTo(contrastRatio("#ffffff", "#2a78d6"), 5);
  });

  test("picks the better of white and near-black for each slot", () => {
    expect(labelColorOn("#eda100")).toBe("#0b0b0b");
    expect(labelColorOn("#0d366b")).toBe("#ffffff");
    expect(labelColorOn("#6250d6")).toBe("#ffffff");
    for (const hex of [...CATEGORICAL_LIGHT, ...CATEGORICAL_DARK]) {
      const chosen = labelColorOn(hex);
      const other = chosen === "#ffffff" ? "#0b0b0b" : "#ffffff";
      expect(contrastRatio(hex, chosen)).toBeGreaterThanOrEqual(contrastRatio(hex, other));
    }
  });
});
