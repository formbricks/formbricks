// https://github.com/airbnb/javascript/#naming--uppercase
import { TProjectStyling } from "@formbricks/types/project";
import { isLight, mixColor } from "@/lib/utils/colors";

export const COLOR_DEFAULTS = {
  brandColor: "#64748b",
  questionColor: "#2b2524",
  inputColor: "#ffffff",
  inputBorderColor: "#cbd5e1",
  cardBackgroundColor: "#ffffff",
  cardBorderColor: "#f8fafc",
  highlightBorderColor: "#64748b",
} as const;

export const ADVANCED_DEFAULTS = {
  accentBgColor: "#e2e8f0",
  accentBgColorSelected: "#f1f5f9",
  buttonBgColor: COLOR_DEFAULTS.brandColor,
  buttonTextColor: "#ffffff",
  buttonBorderRadius: 8,
  buttonFontSize: 16,
  buttonFontWeight: "500",
  buttonPaddingX: 12,
  buttonPaddingY: 12,
  inputBgColor: "#f8fafc",
  inputBorderColor: COLOR_DEFAULTS.inputBorderColor,
  inputTextColor: "#0f172a",
  inputBorderRadius: 8,
  inputHeight: 40,
  inputFontSize: 14,
  inputPaddingX: 16,
  inputPaddingY: 16,
  inputPlaceholderOpacity: 0.5,
  inputShadow: "0 1px 2px 0 rgb(0 0 0 / 0.05)",
  optionBgColor: "#f8fafc",
  optionLabelColor: "#0f172a",
  optionBorderRadius: 8,
  optionPaddingX: 16,
  optionPaddingY: 16,
  optionFontSize: 14,
  elementHeadlineFontSize: 16,
  elementHeadlineFontWeight: "600",
  elementHeadlineColor: "#0f172a",
  elementDescriptionFontSize: 14,
  elementDescriptionFontWeight: "400",
  elementDescriptionColor: "#334155",
  elementUpperLabelFontSize: 12,
  elementUpperLabelColor: "#64748b",
  elementUpperLabelFontWeight: "400",
  progressTrackHeight: 8,
  progressTrackBgColor: `${COLOR_DEFAULTS.brandColor}33`,
  progressIndicatorBgColor: COLOR_DEFAULTS.brandColor,
} as const;

export const defaultStyling: TProjectStyling = {
  allowStyleOverwrite: true,
  brandColor: {
    light: COLOR_DEFAULTS.brandColor,
  },
  questionColor: {
    light: COLOR_DEFAULTS.questionColor,
  },
  inputColor: {
    light: COLOR_DEFAULTS.inputColor,
  },
  inputBorderColor: {
    light: COLOR_DEFAULTS.inputBorderColor,
  },
  cardBackgroundColor: {
    light: COLOR_DEFAULTS.cardBackgroundColor,
  },
  cardBorderColor: {
    light: COLOR_DEFAULTS.cardBorderColor,
  },
  isLogoHidden: false,
  highlightBorderColor: undefined,
  isDarkModeEnabled: false,
  roundness: 8,
  cardArrangement: {
    linkSurveys: "straight",
    appSurveys: "straight",
  },
  accentBgColor: {
    light: ADVANCED_DEFAULTS.accentBgColor,
  },
  accentBgColorSelected: {
    light: ADVANCED_DEFAULTS.accentBgColorSelected,
  },
  buttonBgColor: {
    light: ADVANCED_DEFAULTS.buttonBgColor,
  },
  buttonTextColor: {
    light: ADVANCED_DEFAULTS.buttonTextColor,
  },
  buttonBorderRadius: ADVANCED_DEFAULTS.buttonBorderRadius,
  buttonFontSize: ADVANCED_DEFAULTS.buttonFontSize,
  buttonFontWeight: ADVANCED_DEFAULTS.buttonFontWeight,
  buttonPaddingX: ADVANCED_DEFAULTS.buttonPaddingX,
  buttonPaddingY: ADVANCED_DEFAULTS.buttonPaddingY,
  inputTextColor: {
    light: ADVANCED_DEFAULTS.inputTextColor,
  },
  inputBorderRadius: ADVANCED_DEFAULTS.inputBorderRadius,
  inputHeight: ADVANCED_DEFAULTS.inputHeight,
  inputFontSize: ADVANCED_DEFAULTS.inputFontSize,
  inputPaddingX: ADVANCED_DEFAULTS.inputPaddingX,
  inputPaddingY: ADVANCED_DEFAULTS.inputPaddingY,
  inputPlaceholderOpacity: ADVANCED_DEFAULTS.inputPlaceholderOpacity,
  inputShadow: ADVANCED_DEFAULTS.inputShadow,
  optionBgColor: {
    light: ADVANCED_DEFAULTS.optionBgColor,
  },
  optionLabelColor: {
    light: ADVANCED_DEFAULTS.optionLabelColor,
  },
  optionBorderRadius: ADVANCED_DEFAULTS.optionBorderRadius,
  optionPaddingX: ADVANCED_DEFAULTS.optionPaddingX,
  optionPaddingY: ADVANCED_DEFAULTS.optionPaddingY,
  optionFontSize: ADVANCED_DEFAULTS.optionFontSize,
  elementHeadlineFontSize: ADVANCED_DEFAULTS.elementHeadlineFontSize,
  elementHeadlineFontWeight: ADVANCED_DEFAULTS.elementHeadlineFontWeight,
  elementHeadlineColor: {
    light: ADVANCED_DEFAULTS.elementHeadlineColor,
  },
  elementDescriptionFontSize: ADVANCED_DEFAULTS.elementDescriptionFontSize,
  elementDescriptionFontWeight: ADVANCED_DEFAULTS.elementDescriptionFontWeight,
  elementDescriptionColor: {
    light: ADVANCED_DEFAULTS.elementDescriptionColor,
  },
  elementUpperLabelFontSize: ADVANCED_DEFAULTS.elementUpperLabelFontSize,
  elementUpperLabelColor: {
    light: ADVANCED_DEFAULTS.elementUpperLabelColor,
  },
  elementUpperLabelFontWeight: ADVANCED_DEFAULTS.elementUpperLabelFontWeight,
  progressTrackHeight: ADVANCED_DEFAULTS.progressTrackHeight,
  progressTrackBgColor: {
    light: ADVANCED_DEFAULTS.progressTrackBgColor,
  },
  progressIndicatorBgColor: {
    light: ADVANCED_DEFAULTS.progressIndicatorBgColor,
  },
};

/**
 * Derives a complete set of suggested color values from a single brand color.
 *
 * Used by both the project-level "Suggest Colors" button and as the
 * brand-aware defaults when opening a styling form for the first time.
 *
 * The returned object is a flat map of form-field paths to values so it
 * can be spread directly into form defaults or applied via `form.setValue`.
 */
export const getSuggestedColors = (brandColor: string) => {
  const isBrandLight = isLight(brandColor);

  // Accent text: darken the brand if it's light, otherwise use as-is
  const accentText = isBrandLight ? mixColor(brandColor, "#000000", 0.6) : brandColor;
  // Question / dark text: brand darkened with black (visible brand tint)
  const questionColor = mixColor(brandColor, "#000000", 0.35);
  // Input / option background: white with noticeable brand tint
  const inputBg = mixColor(brandColor, "#ffffff", 0.92);
  // Input border: visible brand-tinted border
  const inputBorder = mixColor(brandColor, "#ffffff", 0.6);
  // Card tones
  const cardBg = mixColor(brandColor, "#ffffff", 0.97);
  const cardBorder = mixColor(brandColor, "#ffffff", 0.8);
  // Page background
  const pageBg = mixColor(brandColor, "#ffffff", 0.855);

  return {
    // General
    "brandColor.light": brandColor,
    "questionColor.light": questionColor,

    // Accent
    "accentBgColor.light": brandColor,
    "accentBgColorSelected.light": mixColor(brandColor, isBrandLight ? "#000000" : "#ffffff", 0.1),

    // Headlines & Descriptions
    "elementHeadlineColor.light": accentText,
    "elementDescriptionColor.light": mixColor(accentText, "#ffffff", 0.3),
    "elementUpperLabelColor.light": mixColor(accentText, "#ffffff", 0.5),

    // Buttons
    "buttonBgColor.light": brandColor,
    "buttonTextColor.light": isBrandLight ? "#0f172a" : "#ffffff",

    // Inputs
    "inputColor.light": inputBg,
    "inputBorderColor.light": inputBorder,
    "inputTextColor.light": questionColor,

    // Options (Radio / Checkbox)
    "optionBgColor.light": inputBg,
    "optionLabelColor.light": questionColor,

    // Card
    "cardBackgroundColor.light": cardBg,
    "cardBorderColor.light": cardBorder,

    // Highlight / Focus
    "highlightBorderColor.light": mixColor(brandColor, "#ffffff", 0.25),

    // Progress Bar
    "progressIndicatorBgColor.light": brandColor,
    "progressTrackBgColor.light": mixColor(brandColor, "#ffffff", 0.8),

    // Background
    background: { bg: pageBg, bgType: "color" as const, brightness: 100 },
  };
};

/**
 * Returns brand-color-derived defaults for styling fields that should
 * match the brand color when not explicitly saved by the user.
 *
 * These values sit between `defaultStyling` and the saved styling in
 * the spread order so that explicitly saved values always win.
 *
 * Re-uses `getSuggestedColors` internally but reshapes the flat
 * dot-path keys into the nested object format expected by form defaults.
 */
export const getBrandDerivedDefaults = (brandColor: string) => {
  const suggested = getSuggestedColors(brandColor);

  return {
    // General colors
    questionColor: { light: suggested["questionColor.light"] },

    // Accent
    accentBgColor: { light: suggested["accentBgColor.light"] },
    accentBgColorSelected: { light: suggested["accentBgColorSelected.light"] },

    // Headlines & Descriptions
    elementHeadlineColor: { light: suggested["elementHeadlineColor.light"] },
    elementDescriptionColor: { light: suggested["elementDescriptionColor.light"] },
    elementUpperLabelColor: { light: suggested["elementUpperLabelColor.light"] },

    // Buttons
    buttonBgColor: { light: suggested["buttonBgColor.light"] },
    buttonTextColor: { light: suggested["buttonTextColor.light"] },

    // Inputs
    inputColor: { light: suggested["inputColor.light"] },
    inputBorderColor: { light: suggested["inputBorderColor.light"] },
    inputTextColor: { light: suggested["inputTextColor.light"] },

    // Options (Radio / Checkbox)
    optionBgColor: { light: suggested["optionBgColor.light"] },
    optionLabelColor: { light: suggested["optionLabelColor.light"] },

    // Card
    cardBackgroundColor: { light: suggested["cardBackgroundColor.light"] },
    cardBorderColor: { light: suggested["cardBorderColor.light"] },

    // Highlight / Focus
    highlightBorderColor: { light: suggested["highlightBorderColor.light"] },

    // Progress Bar
    progressIndicatorBgColor: { light: suggested["progressIndicatorBgColor.light"] },
    progressTrackBgColor: { light: suggested["progressTrackBgColor.light"] },
  };
};
