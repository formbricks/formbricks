import { ensureReadable, getContrastRatio, getReadableTextColor, mixColor, normalizeHex } from "./colors";
import type { TBaseStyling } from "./styling";

export type TSurveyAppearance = "light" | "dark";
export const STYLING_COLOR_KEYS = [
  "brandColor",
  "accentBgColor",
  "accentBgColorSelected",
  "buttonBgColor",
  "buttonTextColor",
  "inputBgColor",
  "inputBorderColor",
  "inputTextColor",
  "optionBgColor",
  "optionLabelColor",
  "optionBorderColor",
  "elementHeadlineColor",
  "elementDescriptionColor",
  "elementUpperLabelColor",
  "progressTrackBgColor",
  "progressIndicatorBgColor",
  "cardBackgroundColor",
  "cardBorderColor",
  "highlightBorderColor",
] as const satisfies readonly (keyof TBaseStyling)[];
export type TStylingColorKey = (typeof STYLING_COLOR_KEYS)[number];

const validColor = (value: string | null | undefined, fallback: string): string =>
  value && normalizeHex(value) ? (value.startsWith("#") ? value : `#${value}`) : fallback;

/** Derived values are transient. Persist only creator overrides, never this projection. */
export const deriveDarkColors = (styling: TBaseStyling): Record<TStylingColorKey, string> => {
  const brand = validColor(styling.brandColor?.light, "#1e40af");
  const card = validColor(styling.cardBackgroundColor?.dark, mixColor(brand, "#0b0f17", 0.9));
  const input = validColor(styling.inputBgColor?.dark, mixColor(brand, "#0b0f17", 0.82));
  const option = validColor(styling.optionBgColor?.dark, mixColor(brand, "#0b0f17", 0.82));
  const selectedOption = mixColor(option, "#ffffff", 0.06);
  const text = mixColor(brand, "#ffffff", 0.82);
  const button = validColor(styling.buttonBgColor?.light, brand);
  const result: Record<TStylingColorKey, string> = {
    brandColor: brand,
    cardBackgroundColor: card,
    cardBorderColor: ensureReadable(mixColor(brand, "#ffffff", 0.3), card, 3),
    highlightBorderColor: ensureReadable(brand, card, 3),
    inputBgColor: input,
    optionBgColor: option,
    accentBgColor: mixColor(input, "#ffffff", 0.06),
    accentBgColorSelected: mixColor(input, "#ffffff", 0.12),
    elementHeadlineColor: ensureReadable(text, card),
    elementDescriptionColor: ensureReadable(text, card),
    elementUpperLabelColor: ensureReadable(text, card),
    inputTextColor: ensureReadable(ensureReadable(text, input), mixColor(input, "#ffffff", 0.06)),
    optionLabelColor: ensureReadable(ensureReadable(text, option), selectedOption),
    inputBorderColor: ensureReadable(mixColor(brand, "#ffffff", 0.4), input, 3),
    optionBorderColor: ensureReadable(mixColor(brand, "#ffffff", 0.4), option, 3),
    buttonBgColor: button,
    buttonTextColor: validColor(styling.buttonTextColor?.light, getReadableTextColor(button)),
    progressTrackBgColor: ensureReadable(mixColor(brand, "#ffffff", 0.3), card, 3),
    progressIndicatorBgColor: validColor(styling.progressIndicatorBgColor?.light, brand),
  };
  return result;
};

/** Projects effective colors into .light for existing renderers without mutating saved styling. */
export const resolveStylingAppearance = <T extends TBaseStyling>(
  styling: T,
  appearance: TSurveyAppearance
): T => {
  if (appearance === "light") return styling;
  const derived = deriveDarkColors(styling);
  const resolved = { ...styling };
  for (const field of STYLING_COLOR_KEYS) {
    // Absence controls whether the app card has a highlight border at all.
    if (field === "highlightBorderColor" && !styling[field]) continue;
    resolved[field] = { ...styling[field], light: validColor(styling[field]?.dark, derived[field]) };
  }
  return resolved;
};

export interface TDarkContrastWarning {
  field: TStylingColorKey;
  backgroundField: TStylingColorKey;
  ratio: number;
  minimum: number;
}

// Checks token pairs only. Customer CSS, images, transparency and embed contents need rendered QA.
export const getDarkContrastWarnings = (styling: TBaseStyling): TDarkContrastWarning[] => {
  const colors = resolveStylingAppearance(styling, "dark");
  const pairs: [TStylingColorKey, TStylingColorKey, number][] = [
    ["elementHeadlineColor", "cardBackgroundColor", 4.5],
    ["elementDescriptionColor", "cardBackgroundColor", 4.5],
    ["elementUpperLabelColor", "cardBackgroundColor", 4.5],
    ["inputTextColor", "inputBgColor", 4.5],
    ["optionLabelColor", "optionBgColor", 4.5],
    ["optionLabelColor", "accentBgColorSelected", 4.5],
    ["buttonTextColor", "buttonBgColor", 4.5],
    ["brandColor", "cardBackgroundColor", 3],
    ["buttonBgColor", "cardBackgroundColor", 3],
    ["inputBorderColor", "inputBgColor", 3],
    ["optionBorderColor", "optionBgColor", 3],
    ["progressIndicatorBgColor", "progressTrackBgColor", 3],
  ];
  const warnings = pairs.flatMap(([field, backgroundField, minimum]) => {
    const ratio = getContrastRatio(colors[field]!.light, colors[backgroundField]!.light);
    return ratio < minimum ? [{ field, backgroundField, ratio, minimum }] : [];
  });
  const selectedRatio = getContrastRatio(
    colors.optionLabelColor!.light,
    mixColor(colors.optionBgColor!.light, "#ffffff", 0.06)
  );
  if (selectedRatio < 4.5)
    warnings.push({
      field: "optionLabelColor",
      backgroundField: "optionBgColor",
      ratio: selectedRatio,
      minimum: 4.5,
    });
  return warnings;
};
