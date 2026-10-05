import { describe, expect, test } from "vitest";
import { deriveDarkColors, getDarkContrastWarnings, resolveStylingAppearance } from "./appearance";
import { getContrastRatio, mixColor } from "./colors";
import type { TBaseStyling } from "./styling";

describe("dark palette", () => {
  test("derives readable semantic text and borders across 216 brand colors", () => {
    for (const r of [0, 51, 102, 153, 204, 255]) {
      for (const g of [0, 51, 102, 153, 204, 255]) {
        for (const b of [0, 51, 102, 153, 204, 255]) {
          const brand = `#${[r, g, b].map((c) => c.toString(16).padStart(2, "0")).join("")}`;
          const colors = deriveDarkColors({ brandColor: { light: brand } });
          expect(
            getContrastRatio(colors.elementHeadlineColor, colors.cardBackgroundColor)
          ).toBeGreaterThanOrEqual(4.5);
          expect(getContrastRatio(colors.inputTextColor, colors.inputBgColor)).toBeGreaterThanOrEqual(4.5);
          expect(getContrastRatio(colors.optionLabelColor, colors.optionBgColor)).toBeGreaterThanOrEqual(4.5);
          expect(
            getContrastRatio(colors.optionLabelColor, mixColor(colors.optionBgColor, "#ffffff", 0.06))
          ).toBeGreaterThanOrEqual(4.5);
          expect(getContrastRatio(colors.inputBorderColor, colors.inputBgColor)).toBeGreaterThanOrEqual(3);
          expect(
            getContrastRatio(colors.progressTrackBgColor, colors.cardBackgroundColor)
          ).toBeGreaterThanOrEqual(3);
          expect(colors.brandColor).toBe(brand);
        }
      }
    }
  });

  test("preserves manual overrides and non-colors without mutating the saved values", () => {
    const styling: TBaseStyling = {
      roundness: 12,
      brandColor: { light: "#146a5d" },
      elementHeadlineColor: { light: "#111111", dark: "#ffd400" },
      footerLinkColor: { light: "#000000", dark: "#ffffff" },
    };
    const resolved = resolveStylingAppearance(styling, "dark");
    expect(resolved.elementHeadlineColor?.light).toBe("#ffd400");
    expect(resolved.brandColor?.light).toBe("#146a5d");
    expect(resolved.roundness).toBe(12);
    expect(resolved.footerLinkColor).toEqual(styling.footerLinkColor);
    expect(styling.elementHeadlineColor?.light).toBe("#111111");
    expect(resolveStylingAppearance(styling, "light")).toBe(styling);
    expect(resolved.highlightBorderColor).toBeUndefined();
  });

  test("clearing an override resumes derivation, and generated colors follow brand edits", () => {
    const base = { brandColor: { light: "#146a5d" }, cardBackgroundColor: { light: "#ffffff", dark: null } };
    expect(resolveStylingAppearance(base, "dark").cardBackgroundColor.light).toBe(
      deriveDarkColors(base).cardBackgroundColor
    );
    expect(deriveDarkColors(base).cardBackgroundColor).not.toBe(
      deriveDarkColors({ brandColor: { light: "#ffd400" } }).cardBackgroundColor
    );
  });

  test("warns on unreadable explicit pairs instead of changing customer colors", () => {
    const styling = {
      cardBackgroundColor: { light: "#ffffff", dark: "#111111" },
      elementHeadlineColor: { light: "#222222", dark: "#111111" },
    };
    expect(getDarkContrastWarnings(styling)).toContainEqual({
      field: "elementHeadlineColor",
      backgroundField: "cardBackgroundColor",
      ratio: 1,
      minimum: 4.5,
    });
    expect(resolveStylingAppearance(styling, "dark").elementHeadlineColor.light).toBe("#111111");
  });
});
