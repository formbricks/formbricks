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
  background: {
    bg: "#fff",
    bgType: "color",
  },
  roundness: 8,
  cardArrangement: {
    linkSurveys: "straight",
    appSurveys: "straight",
  },
};
