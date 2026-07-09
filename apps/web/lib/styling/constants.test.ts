import { describe, expect, test } from "vitest";
import { AA_CONTRAST_RATIO, getContrastRatio, mixColor } from "@/lib/utils/colors";
import { getSuggestedColors } from "./constants";

describe("getSuggestedColors", () => {
  test("always suggests white for card background color", () => {
    const greenBrand = getSuggestedColors("#00ab3b");
    const roseBrand = getSuggestedColors("#e11d48");

    expect(greenBrand["cardBackgroundColor.light"]).toBe("#ffffff");
    expect(roseBrand["cardBackgroundColor.light"]).toBe("#ffffff");
  });

  test("suggests text/surface pairs that clear WCAG AA for any brand color", () => {
    const textPairs = (colors: Record<string, any>): [string, string][] => [
      [colors["elementHeadlineColor.light"], colors["cardBackgroundColor.light"]],
      [colors["elementDescriptionColor.light"], colors["cardBackgroundColor.light"]],
      [colors["elementUpperLabelColor.light"], colors["cardBackgroundColor.light"]],
      [colors["inputTextColor.light"], colors["inputBgColor.light"]],
      [colors["optionLabelColor.light"], colors["optionBgColor.light"]],
      // Selected/hovered option darkens the option bg by 5% — the label must still clear AA.
      [colors["optionLabelColor.light"], mixColor(colors["optionBgColor.light"], "#000000", 0.05)],
      [colors["buttonTextColor.light"], colors["buttonBgColor.light"]],
    ];

    for (let r = 0; r <= 255; r += 51) {
      for (let g = 0; g <= 255; g += 51) {
        for (let b = 0; b <= 255; b += 51) {
          const brand = "#" + [r, g, b].map((x) => x.toString(16).padStart(2, "0")).join("");
          for (const [text, surface] of textPairs(getSuggestedColors(brand))) {
            expect(getContrastRatio(text, surface)).toBeGreaterThanOrEqual(AA_CONTRAST_RATIO);
          }
        }
      }
    }
  });
});
