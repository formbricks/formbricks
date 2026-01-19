import { TProjectStyling } from "@formbricks/types/project";

export const THEME_NAMES = [
  "fall",
  "spring",
  "summer",
  "monochrome",
  "bubblegum",
  "forest",
  "ocean",
  "sunset",
] as const;

export type TThemeName = (typeof THEME_NAMES)[number];

export type TTheme = Pick<
  TProjectStyling,
  | "elementHeadlineColor"
  | "elementDescriptionColor"
  | "inputColor"
  | "inputBorderColor"
  | "inputTextColor"
  | "buttonBgColor"
  | "buttonTextColor"
  | "optionBgColor"
  | "optionLabelColor"
  | "cardBackgroundColor"
  | "cardBorderColor"
  | "progressTrackBgColor"
  | "progressIndicatorBgColor"
>;

export const THEMES: Record<TThemeName, TTheme> = {
  fall: {
    elementHeadlineColor: { light: "#7c2d12" }, // orange-900
    elementDescriptionColor: { light: "#9a3412" }, // orange-800
    inputColor: { light: "#fff7ed" }, // orange-50
    inputBorderColor: { light: "#fdba74" }, // orange-300
    inputTextColor: { light: "#431407" }, // orange-950
    buttonBgColor: { light: "#ea580c" }, // orange-600
    buttonTextColor: { light: "#ffffff" },
    optionBgColor: { light: "#ffedd5" }, // orange-100
    optionLabelColor: { light: "#9a3412" }, // orange-800
    cardBackgroundColor: { light: "#fffaf0" },
    cardBorderColor: { light: "#fdba74" }, // orange-300
    progressTrackBgColor: { light: "#fed7aa" }, // orange-200
    progressIndicatorBgColor: { light: "#ea580c" }, // orange-600
  },
  spring: {
    elementHeadlineColor: { light: "#14532d" }, // green-900
    elementDescriptionColor: { light: "#166534" }, // green-800
    inputColor: { light: "#f0fdf4" }, // green-50
    inputBorderColor: { light: "#86efac" }, // green-300
    inputTextColor: { light: "#052e16" }, // green-950
    buttonBgColor: { light: "#16a34a" }, // green-600
    buttonTextColor: { light: "#ffffff" },
    optionBgColor: { light: "#dcfce7" }, // green-100
    optionLabelColor: { light: "#166534" }, // green-800
    cardBackgroundColor: { light: "#f0fdf4" },
    cardBorderColor: { light: "#86efac" }, // green-300
    progressTrackBgColor: { light: "#bbf7d0" }, // green-200
    progressIndicatorBgColor: { light: "#16a34a" }, // green-600
  },
  summer: {
    elementHeadlineColor: { light: "#0c4a6e" }, // sky-900
    elementDescriptionColor: { light: "#0369a1" }, // sky-700
    inputColor: { light: "#f0f9ff" }, // sky-50
    inputBorderColor: { light: "#7dd3fc" }, // sky-300
    inputTextColor: { light: "#082f49" }, // sky-950
    buttonBgColor: { light: "#0284c7" }, // sky-600
    buttonTextColor: { light: "#ffffff" },
    optionBgColor: { light: "#e0f2fe" }, // sky-100
    optionLabelColor: { light: "#0369a1" }, // sky-700
    cardBackgroundColor: { light: "#f0f9ff" },
    cardBorderColor: { light: "#7dd3fc" }, // sky-300
    progressTrackBgColor: { light: "#bae6fd" }, // sky-200
    progressIndicatorBgColor: { light: "#0284c7" }, // sky-600
  },
  monochrome: {
    elementHeadlineColor: { light: "#000000" },
    elementDescriptionColor: { light: "#333333" },
    inputColor: { light: "#ffffff" },
    inputBorderColor: { light: "#000000" },
    inputTextColor: { light: "#000000" },
    buttonBgColor: { light: "#000000" },
    buttonTextColor: { light: "#ffffff" },
    optionBgColor: { light: "#f5f5f5" },
    optionLabelColor: { light: "#000000" },
    cardBackgroundColor: { light: "#ffffff" },
    cardBorderColor: { light: "#000000" },
    progressTrackBgColor: { light: "#e5e5e5" },
    progressIndicatorBgColor: { light: "#000000" },
  },
  bubblegum: {
    elementHeadlineColor: { light: "#831843" }, // pink-900
    elementDescriptionColor: { light: "#be185d" }, // pink-700
    inputColor: { light: "#fdf2f8" }, // pink-50
    inputBorderColor: { light: "#f9a8d4" }, // pink-300
    inputTextColor: { light: "#500724" }, // pink-950
    buttonBgColor: { light: "#db2777" }, // pink-600
    buttonTextColor: { light: "#ffffff" },
    optionBgColor: { light: "#fce7f3" }, // pink-100
    optionLabelColor: { light: "#be185d" }, // pink-700
    cardBackgroundColor: { light: "#fdf2f8" },
    cardBorderColor: { light: "#f9a8d4" }, // pink-300
    progressTrackBgColor: { light: "#fbcfe8" }, // pink-200
    progressIndicatorBgColor: { light: "#db2777" }, // pink-600
  },
  forest: {
    elementHeadlineColor: { light: "#14532d" }, // green-900
    elementDescriptionColor: { light: "#15803d" }, // green-700
    inputColor: { light: "#f0fdf4" }, // green-50
    inputBorderColor: { light: "#4ade80" }, // green-400
    inputTextColor: { light: "#052e16" }, // green-950
    buttonBgColor: { light: "#166534" }, // green-800
    buttonTextColor: { light: "#ffffff" },
    optionBgColor: { light: "#dcfce7" }, // green-100
    optionLabelColor: { light: "#15803d" }, // green-700
    cardBackgroundColor: { light: "#f0fdf4" },
    cardBorderColor: { light: "#22c55e" }, // green-500
    progressTrackBgColor: { light: "#bbf7d0" }, // green-200
    progressIndicatorBgColor: { light: "#166534" }, // green-800
  },
  ocean: {
    elementHeadlineColor: { light: "#1e3a8a" }, // blue-900
    elementDescriptionColor: { light: "#1d4ed8" }, // blue-700
    inputColor: { light: "#eff6ff" }, // blue-50
    inputBorderColor: { light: "#60a5fa" }, // blue-400
    inputTextColor: { light: "#172554" }, // blue-950
    buttonBgColor: { light: "#1e40af" }, // blue-800
    buttonTextColor: { light: "#ffffff" },
    optionBgColor: { light: "#dbeafe" }, // blue-100
    optionLabelColor: { light: "#1d4ed8" }, // blue-700
    cardBackgroundColor: { light: "#eff6ff" },
    cardBorderColor: { light: "#3b82f6" }, // blue-500
    progressTrackBgColor: { light: "#bfdbfe" }, // blue-200
    progressIndicatorBgColor: { light: "#1e40af" }, // blue-800
  },
  sunset: {
    elementHeadlineColor: { light: "#7f1d1d" }, // red-900
    elementDescriptionColor: { light: "#b91c1c" }, // red-700
    inputColor: { light: "#fef2f2" }, // red-50
    inputBorderColor: { light: "#f87171" }, // red-400
    inputTextColor: { light: "#450a0a" }, // red-950
    buttonBgColor: { light: "#991b1b" }, // red-800
    buttonTextColor: { light: "#ffffff" },
    optionBgColor: { light: "#fee2e2" }, // red-100
    optionLabelColor: { light: "#b91c1c" }, // red-700
    cardBackgroundColor: { light: "#fef2f2" },
    cardBorderColor: { light: "#ef4444" }, // red-500
    progressTrackBgColor: { light: "#fecaca" }, // red-200
    progressIndicatorBgColor: { light: "#991b1b" }, // red-800
  },
};
