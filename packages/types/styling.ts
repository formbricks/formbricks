import { z } from "zod";
import { ZColor, ZStorageUrl } from "./common";

export const ZStylingColor = z.object({
  light: ZColor,
  dark: ZColor.nullish(),
});
export type TStylingColor = z.infer<typeof ZStylingColor>;

export const ZCardArrangementOptions = z.enum(["casual", "straight", "simple"]);
export type TCardArrangementOptions = z.infer<typeof ZCardArrangementOptions>;

export const ZCardArrangement = z.object({
  linkSurveys: ZCardArrangementOptions,
  appSurveys: ZCardArrangementOptions,
});

export const ZLogo = z.object({
  url: ZStorageUrl.optional(),
  bgColor: z.string().optional(),
});
export type TLogo = z.infer<typeof ZLogo>;

export const ZSurveyStylingBackground = z
  .object({
    bg: z.string().nullish(),
    bgType: z.enum(["animation", "color", "image", "upload"]).nullish(),
    brightness: z.number().nullish(),
  })
  .refine(
    (surveyBackground) => {
      if (surveyBackground.bgType === "upload") {
        return Boolean(surveyBackground.bg);
      }

      return true;
    },
    { message: "Invalid background" }
  );

export type TSurveyStylingBackground = z.infer<typeof ZSurveyStylingBackground>;

export const ZBaseStyling = z.object({
  brandColor: ZStylingColor.nullish(),
  accentBgColor: ZStylingColor.nullish(),
  accentBgColorSelected: ZStylingColor.nullish(),
  fontFamily: z.string().nullish(),

  // Buttons
  buttonBgColor: ZStylingColor.nullish(),
  buttonTextColor: ZStylingColor.nullish(),
  buttonBorderRadius: z.union([z.number(), z.string()]).nullish(),
  buttonHeight: z.union([z.number(), z.string()]).nullish(),
  buttonFontSize: z.union([z.number(), z.string()]).nullish(),
  buttonFontWeight: z.union([z.string(), z.number()]).nullish(),
  buttonPaddingX: z.union([z.number(), z.string()]).nullish(),
  buttonPaddingY: z.union([z.number(), z.string()]).nullish(),

  // Inputs
  inputBgColor: ZStylingColor.nullish(),
  inputBorderColor: ZStylingColor.nullish(),
  inputBorderRadius: z.union([z.number(), z.string()]).nullish(),
  inputHeight: z.union([z.number(), z.string()]).nullish(),
  inputTextColor: ZStylingColor.nullish(),
  inputFontSize: z.union([z.number(), z.string()]).nullish(),
  inputPlaceholderOpacity: z.number().max(1).min(0).nullish(),
  inputPaddingX: z.union([z.number(), z.string()]).nullish(),
  inputPaddingY: z.union([z.number(), z.string()]).nullish(),
  inputShadow: z.string().nullish(),

  // Options
  optionBgColor: ZStylingColor.nullish(),
  optionLabelColor: ZStylingColor.nullish(),
  optionBorderColor: ZStylingColor.nullish(),
  optionBorderRadius: z.union([z.number(), z.string()]).nullish(),
  optionPaddingX: z.union([z.number(), z.string()]).nullish(),
  optionPaddingY: z.union([z.number(), z.string()]).nullish(),
  optionFontSize: z.union([z.number(), z.string()]).nullish(),

  // Headlines & Descriptions
  elementHeadlineFontSize: z.union([z.number(), z.string()]).nullish(),
  elementHeadlineFontWeight: z.union([z.string(), z.number()]).nullish(),
  elementHeadlineColor: ZStylingColor.nullish(),
  elementDescriptionFontSize: z.union([z.number(), z.string()]).nullish(),
  elementDescriptionFontWeight: z.union([z.string(), z.number()]).nullish(),
  elementDescriptionColor: ZStylingColor.nullish(),
  elementUpperLabelFontSize: z.union([z.number(), z.string()]).nullish(),
  elementUpperLabelColor: ZStylingColor.nullish(),
  elementUpperLabelFontWeight: z.union([z.string(), z.number()]).nullish(),

  // Progress Bar
  progressTrackHeight: z.union([z.number(), z.string()]).nullish(),
  progressTrackBgColor: ZStylingColor.nullish(),
  progressIndicatorBgColor: ZStylingColor.nullish(),

  questionColor: ZStylingColor.nullish(),
  inputColor: ZStylingColor.nullish(), // legacy? keep for compat?
  // inputBorderColor: ZStylingColor.nullish(), // defined above
  cardBackgroundColor: ZStylingColor.nullish(),
  cardBorderColor: ZStylingColor.nullish(),
  highlightBorderColor: ZStylingColor.nullish(),
  isDarkModeEnabled: z.boolean().nullish(),
  roundness: z.union([z.number(), z.string()]).nullish(),
  cardArrangement: ZCardArrangement.nullish(),
  background: ZSurveyStylingBackground.nullish(),
  hideProgressBar: z.boolean().nullish(),
  isLogoHidden: z.boolean().nullish(),
  logo: ZLogo.nullish(),
});

export type TBaseStyling = z.infer<typeof ZBaseStyling>;
