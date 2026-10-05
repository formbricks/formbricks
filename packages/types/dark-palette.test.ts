import { describe, expect, test } from "vitest";
import { getContrastRatio, mixColor } from "./colors";
import {
  DARK_BASE_COLOR,
  getDarkContrastWarnings,
  getDerivedDarkColors,
  resolveDarkColors,
} from "./dark-palette";

// 6 levels per channel → 216 brand colors, from black through every hue to white.
const LEVELS = ["00", "33", "66", "99", "cc", "ff"];
const BRAND_SWEEP = LEVELS.flatMap((r) => LEVELS.flatMap((g) => LEVELS.map((b) => `#${r}${g}${b}`)));

describe("getDerivedDarkColors", () => {
  test.each(BRAND_SWEEP)("every derived text and border is readable for brand %s", (brand) => {
    const dark = getDerivedDarkColors(brand);
    // The lightest surface text lands on: a hovered/selected option.
    const lightestSurface = mixColor(dark.inputBgColor, "#ffffff", 0.08);

    for (const text of [
      dark.elementHeadlineColor,
      dark.elementDescriptionColor,
      dark.elementUpperLabelColor,
      dark.inputTextColor,
      dark.optionLabelColor,
    ]) {
      expect(getContrastRatio(text, lightestSurface)).toBeGreaterThanOrEqual(4.5);
      expect(getContrastRatio(text, dark.cardBackgroundColor)).toBeGreaterThanOrEqual(4.5);
    }
    expect(getContrastRatio(dark.inputBorderColor, dark.cardBackgroundColor)).toBeGreaterThanOrEqual(3);
    expect(getContrastRatio(dark.progressTrackBgColor, dark.cardBackgroundColor)).toBeGreaterThanOrEqual(3);
    expect(getContrastRatio(dark.highlightBorderColor, dark.cardBackgroundColor)).toBeGreaterThanOrEqual(3);
  });

  test("surfaces are dark and tinted with the brand", () => {
    const dark = getDerivedDarkColors("#1e40af");
    expect(dark.cardBackgroundColor).toBe(mixColor("#1e40af", DARK_BASE_COLOR, 0.9));
    expect(getContrastRatio(dark.cardBackgroundColor, "#000000")).toBeLessThan(1.5);
    expect(dark.cardBackgroundColor).not.toBe(getDerivedDarkColors("#00a54f").cardBackgroundColor);
  });
});

describe("resolveDarkColors", () => {
  test("an explicit dark override wins over the derived value", () => {
    const resolved = resolveDarkColors({
      brandColor: { light: "#1e40af" },
      cardBackgroundColor: { light: "#ffffff", dark: "#123456" },
    });
    expect(resolved.cardBackgroundColor).toBe("#123456");
  });

  test("brand colors keep their light value when no dark value is set (D12)", () => {
    const resolved = resolveDarkColors({
      brandColor: { light: "#146a5d" },
      buttonBgColor: { light: "#146a5d" },
      buttonTextColor: { light: "#ffffff" },
      progressIndicatorBgColor: { light: "#146a5d" },
    });
    expect(resolved.brandColor).toBe("#146a5d");
    expect(resolved.buttonBgColor).toBe("#146a5d");
    expect(resolved.buttonTextColor).toBe("#ffffff");
    expect(resolved.progressIndicatorBgColor).toBe("#146a5d");
  });

  test("surfaces and text ignore their light value and derive from the brand", () => {
    const resolved = resolveDarkColors({
      brandColor: { light: "#146a5d" },
      cardBackgroundColor: { light: "#ffffff" },
      elementHeadlineColor: { light: "#0a352f" },
    });
    const derived = getDerivedDarkColors("#146a5d");
    expect(resolved.cardBackgroundColor).toBe(derived.cardBackgroundColor);
    expect(resolved.elementHeadlineColor).toBe(derived.elementHeadlineColor);
  });

  test("a brand color without any value stays undefined so the CSS default applies", () => {
    expect(resolveDarkColors({}).buttonBgColor).toBeUndefined();
    expect(resolveDarkColors({}).cardBackgroundColor).toBe(getDerivedDarkColors().cardBackgroundColor);
  });
});

describe("getDarkContrastWarnings", () => {
  test("warns about a dark brand that disappears on the dark card", () => {
    const warnings = getDarkContrastWarnings({ brandColor: { light: "#111111" } });
    expect(warnings.map((warning) => warning.key)).toContain("brandColor");
  });

  test("warns about button text that is hard to read on the button", () => {
    const warnings = getDarkContrastWarnings({
      brandColor: { light: "#00a54f" },
      buttonBgColor: { light: "#00a54f" },
      buttonTextColor: { light: "#00b85a" },
    });
    expect(warnings.find((warning) => warning.key === "buttonTextColor")?.minimum).toBe(4.5);
  });

  test("no warning once the creator sets a readable dark value", () => {
    const warnings = getDarkContrastWarnings({ brandColor: { light: "#111111", dark: "#7dd3fc" } });
    expect(warnings).toEqual([]);
  });
});
