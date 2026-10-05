import { describe, expect, test } from "vitest";
import { resetStylingAppearance } from "./reset-appearance";

describe("resetStylingAppearance", () => {
  const saved = {
    brandColor: { light: "#146a5d", dark: "#91d8c5" },
    cardBackgroundColor: { light: "#ffffff", dark: "#121212" },
    roundness: 16,
    overwriteThemeStyling: true,
  };
  const defaults = { brandColor: { light: "#0000ff" }, roundness: 8 };

  test("clears dark overrides without resetting light colors or shared layout", () => {
    const reset = resetStylingAppearance(saved, defaults, "dark");
    expect(reset.brandColor).toEqual({ light: "#146a5d", dark: null });
    expect(reset.cardBackgroundColor).toEqual({ light: "#ffffff", dark: null });
    expect(reset.roundness).toBe(16);
    expect(reset.overwriteThemeStyling).toBe(true);
    expect(saved.brandColor.dark).toBe("#91d8c5");
  });

  test("resets light defaults and keeps the creator's dark overrides", () => {
    const reset = resetStylingAppearance(saved, defaults, "light");
    expect(reset.brandColor).toEqual({ light: "#0000ff", dark: "#91d8c5" });
    expect(reset.cardBackgroundColor.dark).toBe("#121212");
    expect(reset.roundness).toBe(8);
  });
});
