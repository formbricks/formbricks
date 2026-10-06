import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";
import { getDarkReadableColors, getDerivedDarkColors } from "@formbricks/types/dark-palette";
import { mixColor } from "./color";

// The dark fallback blocks in the two stylesheets are written out by hand (CSS cannot import the
// resolver). They paint the first frame before styles.ts runs, so they must match what styles.ts
// emits for a survey without styling, i.e. the palette derived from the default brand color.
const readDarkBlock = (path: string): Record<string, string> => {
  const css = readFileSync(resolve(__dirname, path), "utf8");
  const block = /#fbjs\[data-appearance="dark"\]\s*\{([^}]*)\}/.exec(css)?.[1] ?? "";
  return Object.fromEntries(
    [...block.matchAll(/(--[\w-]+):\s*([^;]+);/g)].map(([, name, value]) => [name, value.trim()])
  );
};

const dark = getDerivedDarkColors("#1e40af");
const readable = getDarkReadableColors("#1e40af", dark.cardBackgroundColor);

describe("dark fallback CSS matches the derived default palette", () => {
  test("survey-ui tokens", () => {
    const tokens = readDarkBlock("../../../survey-ui/src/styles/globals.css");
    expect(tokens).toMatchObject({
      "--background": dark.cardBackgroundColor,
      "--fb-element-headline-color": dark.elementHeadlineColor,
      "--fb-element-description-color": dark.elementDescriptionColor,
      "--fb-element-upper-label-color": dark.elementUpperLabelColor,
      "--fb-input-bg-color": dark.inputBgColor,
      "--fb-input-border-color": dark.inputBorderColor,
      "--fb-input-color": dark.inputTextColor,
      "--fb-option-bg-color": dark.optionBgColor,
      "--fb-option-label-color": dark.optionLabelColor,
      "--fb-progress-track-bg-color": dark.progressTrackBgColor,
      "--fb-accent-background-color": dark.accentBgColor,
      "--fb-accent-background-color-selected": dark.accentBgColorSelected,
      "--fb-tint-color": dark.cardBackgroundColor,
      "--destructive": readable.errorColor,
      "--fb-brand-readable-color": readable.brandTextColor,
    });
  });

  test("renderer tokens", () => {
    const tokens = readDarkBlock("../styles/global.css");
    expect(tokens).toMatchObject({
      "--fb-survey-background-color": dark.cardBackgroundColor,
      "--fb-survey-border-color": dark.cardBorderColor,
      "--color-gray-200": dark.cardBorderColor,
      "--fb-heading-color": dark.elementHeadlineColor,
      "--fb-subheading-color": dark.elementDescriptionColor,
      "--fb-border-color": dark.inputBorderColor,
      "--fb-border-color-highlight": mixColor(dark.inputBorderColor, "#ffffff", 0.1),
      "--fb-placeholder-color": mixColor(dark.inputTextColor, dark.inputBgColor, 0.3),
      "--fb-signature-text-color": mixColor(dark.elementHeadlineColor, "#000000", 0.2),
      "--fb-branding-text-color": mixColor(dark.elementHeadlineColor, "#000000", 0.3),
      "--fb-input-background-color": dark.inputBgColor,
      "--fb-input-background-color-selected": mixColor(dark.inputBgColor, "#ffffff", 0.05),
      "--fb-accent-background-color": dark.accentBgColor,
      "--fb-accent-background-color-selected": dark.accentBgColorSelected,
      "--fb-brand-readable-color": readable.brandTextColor,
    });
  });

  test("focus ring", () => {
    const css = readFileSync(resolve(__dirname, "../../../survey-ui/src/styles/globals.css"), "utf8");
    expect(css).toContain(`--fb-focus-ring-outer-color: ${readable.focusRingColor};`);
  });
});
