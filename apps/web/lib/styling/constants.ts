// https://github.com/airbnb/javascript/#naming--uppercase
import { TWorkspaceStyling } from "@formbricks/types/workspace";
import { DEFAULT_BRAND_COLOR } from "@/lib/brand-color";
import { isLight, mixColor } from "@/lib/utils/colors";

export const COLOR_DEFAULTS = {
  brandColor: "#1e40af",
  elementHeadlineColor: "#142a72",
  inputBgColor: "#edf0f9",
  inputBorderColor: "#a5b3df",
  cardBackgroundColor: "#f8f9fd",
  cardBorderColor: "#d2d9ef",
  highlightBorderColor: "#1e40af",
} as const;

/**
 * Derives a complete set of suggested color values from a single brand color.
 *
 * Used by the workspace-level "Suggest Colors" button **and** to build
 * `STYLE_DEFAULTS` so that a fresh install always has colours that are
 * visually cohesive with the default brand.
 *
 * The returned object is a flat map of form-field paths to values so it
 * can be spread directly into form defaults or applied via `form.setValue`.
 */
export const getSuggestedColors = (brandColor: string = DEFAULT_BRAND_COLOR) => {
  // Question / dark text: brand darkened with black (visible brand tint)
  const questionColor = mixColor(brandColor, "#000000", 0.35);
  // Input / option background: white with noticeable brand tint
  const inputBg = mixColor(brandColor, "#ffffff", 0.92);
  // Input border: visible brand-tinted border
  const inputBorder = mixColor(brandColor, "#ffffff", 0.6);
  // Card tones
  const cardBg = "#ffffff";
  const cardBorder = mixColor(brandColor, "#ffffff", 0.8);
  // Page background
  const pageBg = mixColor(brandColor, "#ffffff", 0.855);

  return {
    // General
    "brandColor.light": brandColor,

    // Headlines & Descriptions
    "elementHeadlineColor.light": questionColor,
    "elementDescriptionColor.light": questionColor,
    "elementUpperLabelColor.light": questionColor,

    // Buttons — use the brand color so the button matches the user's intent.
    "buttonBgColor.light": brandColor,
    "buttonTextColor.light": isLight(brandColor) ? "#0f172a" : "#ffffff",

    // Inputs
    "inputBgColor.light": inputBg,
    "inputBorderColor.light": inputBorder,
    "inputTextColor.light": questionColor,

    // Options (Radio / Checkbox)
    "optionBgColor.light": inputBg,
    "optionLabelColor.light": questionColor,
    "optionBorderColor.light": inputBorder,

    // Card
    "cardBackgroundColor.light": cardBg,
    "cardBorderColor.light": cardBorder,

    // Highlight / Focus
    "highlightBorderColor.light": mixColor(brandColor, "#ffffff", 0.25),

    // Progress Bar — indicator uses the brand color; track is a lighter tint.
    "progressIndicatorBgColor.light": brandColor,
    "progressTrackBgColor.light": mixColor(brandColor, "#ffffff", 0.8),

    // Background
    background: { bg: pageBg, bgType: "color" as const, brightness: 100 },
  };
};

// Pre-compute colors derived from the default brand color.
const _colors = getSuggestedColors(DEFAULT_BRAND_COLOR);

/**
 * Single source of truth for every styling default.
 *
 * Color values are derived from the default brand color (#1e40af) via
 * `getSuggestedColors()`.  Non-color values (dimensions, weights, sizes)
 * are hardcoded here and must be kept in sync with globals.css.
 *
 * Used everywhere: form defaults, preview rendering, email templates,
 * and as the reset target for "Restore defaults".
 */
export const STYLE_DEFAULTS: TWorkspaceStyling = {
  allowStyleOverwrite: true,
  brandColor: { light: _colors["brandColor.light"] },
  inputBorderColor: { light: _colors["inputBorderColor.light"] },
  cardBackgroundColor: { light: _colors["cardBackgroundColor.light"] },
  cardBorderColor: { light: _colors["cardBorderColor.light"] },
  isLogoHidden: false,
  highlightBorderColor: { light: _colors["highlightBorderColor.light"] },
  isDarkModeEnabled: false,
  roundness: 8,
  cardArrangement: { linkSurveys: "simple", appSurveys: "simple" },
  linkSurveyCardWidth: "default",

  // Headlines & Descriptions
  elementHeadlineColor: { light: _colors["elementHeadlineColor.light"] },
  elementHeadlineFontSize: 16,
  elementHeadlineFontWeight: 600,
  elementDescriptionColor: { light: _colors["elementDescriptionColor.light"] },
  elementDescriptionFontSize: 14,
  elementDescriptionFontWeight: 400,
  elementUpperLabelColor: { light: _colors["elementUpperLabelColor.light"] },
  elementUpperLabelFontSize: 12,
  elementUpperLabelFontWeight: 400,

  // Inputs
  inputBgColor: { light: _colors["inputBgColor.light"] },
  inputTextColor: { light: _colors["inputTextColor.light"] },
  inputBorderRadius: 8,
  inputHeight: 20,
  inputFontSize: 14,
  inputPaddingX: 8,
  inputPaddingY: 8,
  inputPlaceholderOpacity: 0.5,
  inputShadow: "0 1px 2px 0 rgb(0 0 0 / 0.05)",

  // Buttons
  buttonBgColor: { light: _colors["buttonBgColor.light"] },
  buttonTextColor: { light: _colors["buttonTextColor.light"] },
  buttonBorderRadius: 8,
  buttonHeight: "auto",
  buttonFontSize: 16,
  buttonFontWeight: 500,
  buttonPaddingX: 12,
  buttonPaddingY: 12,

  // Options
  optionBgColor: { light: _colors["optionBgColor.light"] },
  optionLabelColor: { light: _colors["optionLabelColor.light"] },
  optionBorderColor: { light: _colors["optionBorderColor.light"] },
  optionBorderRadius: 8,
  optionPaddingX: 16,
  optionPaddingY: 16,
  optionFontSize: 14,

  // Progress Bar
  progressTrackHeight: 8,
  progressTrackBgColor: { light: _colors["progressTrackBgColor.light"] },
  progressIndicatorBgColor: { light: _colors["progressIndicatorBgColor.light"] },
};

/**
 * Builds a complete TWorkspaceStyling object from a single brand color.
 *
 * Uses STYLE_DEFAULTS for all non-color properties (dimensions, weights, etc.)
 * and derives every color from the given brand color via getSuggestedColors().
 *
 * Useful when only a brand color is known (e.g. onboarding) and a fully
 * coherent styling object is needed for both preview rendering and persistence.
 */
export const buildStylingFromBrandColor = (brandColor: string = DEFAULT_BRAND_COLOR): TWorkspaceStyling => {
  const colors = getSuggestedColors(brandColor);

  return {
    ...STYLE_DEFAULTS,
    brandColor: { light: colors["brandColor.light"] },
    elementHeadlineColor: { light: colors["elementHeadlineColor.light"] },
    elementDescriptionColor: { light: colors["elementDescriptionColor.light"] },
    elementUpperLabelColor: { light: colors["elementUpperLabelColor.light"] },
    buttonBgColor: { light: colors["buttonBgColor.light"] },
    buttonTextColor: { light: colors["buttonTextColor.light"] },
    inputBgColor: { light: colors["inputBgColor.light"] },
    inputBorderColor: { light: colors["inputBorderColor.light"] },
    inputTextColor: { light: colors["inputTextColor.light"] },
    optionBgColor: { light: colors["optionBgColor.light"] },
    optionLabelColor: { light: colors["optionLabelColor.light"] },
    optionBorderColor: { light: colors["optionBorderColor.light"] },
    cardBackgroundColor: { light: colors["cardBackgroundColor.light"] },
    cardBorderColor: { light: colors["cardBorderColor.light"] },
    highlightBorderColor: { light: colors["highlightBorderColor.light"] },
    progressIndicatorBgColor: { light: colors["progressIndicatorBgColor.light"] },
    progressTrackBgColor: { light: colors["progressTrackBgColor.light"] },
    background: colors.background,
  };
};
