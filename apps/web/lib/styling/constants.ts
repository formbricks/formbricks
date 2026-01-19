// https://github.com/airbnb/javascript/#naming--uppercase
import { TProjectStyling } from "@formbricks/types/project";

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
  buttonBgColor: "#0f172a",
  buttonTextColor: "#f8fafc",
  buttonBorderRadius: 10,
  buttonHeight: 36,
  buttonFontSize: 14,
  buttonFontWeight: "500",
  buttonPaddingX: 16,
  buttonPaddingY: 8,
  inputBgColor: "#f8fafc",
  inputBorderColor: "#64748b",
  inputTextColor: "#0f172a",
  inputBorderRadius: 10,
  inputHeight: 40,
  inputFontSize: 14,
  inputPaddingX: 16,
  inputPaddingY: 16,
  inputPlaceholderOpacity: 0.5,
  inputShadow: "0 1px 2px 0 rgb(0 0 0 / 0.05)",
  optionBgColor: "#f8fafc",
  optionLabelColor: "#0f172a",
  optionBorderRadius: 10,
  optionPaddingX: 16,
  optionPaddingY: 16,
  optionFontSize: 14,
  elementHeadlineFontSize: 16,
  elementHeadlineFontWeight: "400",
  elementHeadlineColor: "#0f172a",
  elementDescriptionFontSize: 14,
  elementDescriptionColor: "#0f172a",
  progressTrackHeight: 8,
  progressTrackBgColor: "#0f172a33",
  progressIndicatorBgColor: "#0f172a",
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
  buttonHeight: ADVANCED_DEFAULTS.buttonHeight,
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
  elementDescriptionColor: {
    light: ADVANCED_DEFAULTS.elementDescriptionColor,
  },
  progressTrackHeight: ADVANCED_DEFAULTS.progressTrackHeight,
  progressTrackBgColor: {
    light: ADVANCED_DEFAULTS.progressTrackBgColor,
  },
  progressIndicatorBgColor: {
    light: ADVANCED_DEFAULTS.progressIndicatorBgColor,
  },
};
