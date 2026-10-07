import { z } from "zod";
import { ZColor, ZStorageUrl } from "./common";
import {
  isSafeThemeBackground,
  isSafeThemeBoxShadow,
  isSafeThemeColor,
  isSafeThemeDimension,
  isSafeThemeFontFamily,
  isSafeThemeFontWeight,
} from "./styling-values";

export const ZStylingColor = z.object({
  light: ZColor,
  dark: ZColor.nullish(),
});
export type TStylingColor = z.infer<typeof ZStylingColor>;

// "cardless" is only supported for link surveys; app surveys keep the card-based arrangements.
export const ZLinkSurveyCardArrangementOptions = z.enum(["casual", "straight", "simple", "cardless"]);
export const ZAppSurveyCardArrangementOptions = z.enum(["casual", "straight", "simple"]);
export type TCardArrangementOptions = z.infer<typeof ZLinkSurveyCardArrangementOptions>;
export type TAppSurveyCardArrangementOptions = z.infer<typeof ZAppSurveyCardArrangementOptions>;

export const ZCardArrangement = z.object({
  linkSurveys: ZLinkSurveyCardArrangementOptions,
  appSurveys: ZAppSurveyCardArrangementOptions,
});

export const ZLinkSurveyCardWidthOptions = z.enum(["narrow", "default", "wide"]);
export type TLinkSurveyCardWidthOptions = z.infer<typeof ZLinkSurveyCardWidthOptions>;

export const LINK_SURVEY_CARD_WIDTH_MAX: Record<TLinkSurveyCardWidthOptions, string> = {
  narrow: "clamp(17.5rem, 88vw, 30rem)",
  default: "clamp(20rem, 92vw, 40rem)",
  wide: "clamp(24rem, 96vw, 60rem)",
};

export const getLinkSurveyCardMaxWidth = (cardWidth?: TLinkSurveyCardWidthOptions | null): string =>
  LINK_SURVEY_CARD_WIDTH_MAX[cardWidth ?? "default"];

/*
 * Free-text theme values are written into generated CSS, so each one must be a valid value for its
 * property and nothing more (ENG-2950, styling-values.ts). Older stored rows may hold values these reject,
 * so the survey read seam (`transformPrismaSurvey`) and the Look & Feel page drop them with
 * `sanitizeThemeStyling` before a save round-trips the row, and the renderer drops them on its own.
 */
const ZStylingDimension = z
  .union([z.number(), z.string()])
  .refine(isSafeThemeDimension, { error: "Invalid size: use a number or a CSS length such as 12px or 1rem" });
const ZStylingFontWeight = z
  .union([z.string(), z.number()])
  .refine(isSafeThemeFontWeight, { error: "Invalid font weight: use 100–900 or a keyword such as bold" });
const ZStylingFontFamily = z
  .string()
  .refine(isSafeThemeFontFamily, { error: "Invalid font family: use a comma-separated list of font names" });
const ZStylingBoxShadow = z.string().refine(isSafeThemeBoxShadow, {
  error: "Invalid shadow: use a CSS box-shadow such as 0 1px 2px #0000000d",
});
const ZStylingFreeColor = z.string().refine(isSafeThemeColor, { error: "Invalid color" });

export const ZLogo = z.object({
  url: ZStorageUrl.optional(),
  bgColor: ZStylingFreeColor.optional(),
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

      // A solid background is written into styles, so it has to be a color.
      return isSafeThemeBackground(surveyBackground);
    },
    {
      error: "Invalid background",
    }
  );

export type TSurveyStylingBackground = z.infer<typeof ZSurveyStylingBackground>;

export const ZBaseStyling = z.object({
  brandColor: ZStylingColor.nullish(),
  accentBgColor: ZStylingColor.nullish(),
  accentBgColorSelected: ZStylingColor.nullish(),
  // Color of the link-survey footer legal links (imprint/privacy/terms/report survey).
  // When unset, the color is auto-adjusted at render time for AA contrast with the background.
  // A cleared color picker is transformed to undefined at the form layer, so this stays a
  // strict ZColor like every other color field.
  footerLinkColor: ZStylingColor.nullish(),
  fontFamily: ZStylingFontFamily.nullish(),

  // Buttons
  buttonBgColor: ZStylingColor.nullish(),
  buttonTextColor: ZStylingColor.nullish(),
  buttonBorderRadius: ZStylingDimension.nullish(),
  buttonHeight: ZStylingDimension.nullish(),
  buttonFontSize: ZStylingDimension.nullish(),
  buttonFontWeight: ZStylingFontWeight.nullish(),
  buttonPaddingX: ZStylingDimension.nullish(),
  buttonPaddingY: ZStylingDimension.nullish(),

  // Inputs
  inputBgColor: ZStylingColor.nullish(),
  inputBorderColor: ZStylingColor.nullish(),
  inputBorderRadius: ZStylingDimension.nullish(),
  inputHeight: ZStylingDimension.nullish(),
  inputTextColor: ZStylingColor.nullish(),
  inputFontSize: ZStylingDimension.nullish(),
  inputPlaceholderOpacity: z.number().max(1).min(0).nullish(),
  inputPaddingX: ZStylingDimension.nullish(),
  inputPaddingY: ZStylingDimension.nullish(),
  inputShadow: ZStylingBoxShadow.nullish(),

  // Options
  optionBgColor: ZStylingColor.nullish(),
  optionLabelColor: ZStylingColor.nullish(),
  optionBorderColor: ZStylingColor.nullish(),
  optionBorderRadius: ZStylingDimension.nullish(),
  optionPaddingX: ZStylingDimension.nullish(),
  optionPaddingY: ZStylingDimension.nullish(),
  optionFontSize: ZStylingDimension.nullish(),

  // Headlines & Descriptions
  elementHeadlineFontSize: ZStylingDimension.nullish(),
  elementHeadlineFontWeight: ZStylingFontWeight.nullish(),
  elementHeadlineColor: ZStylingColor.nullish(),
  elementDescriptionFontSize: ZStylingDimension.nullish(),
  elementDescriptionFontWeight: ZStylingFontWeight.nullish(),
  elementDescriptionColor: ZStylingColor.nullish(),
  elementUpperLabelFontSize: ZStylingDimension.nullish(),
  elementUpperLabelColor: ZStylingColor.nullish(),
  elementUpperLabelFontWeight: ZStylingFontWeight.nullish(),

  // Progress Bar
  progressTrackHeight: ZStylingDimension.nullish(),
  progressTrackBgColor: ZStylingColor.nullish(),
  progressIndicatorBgColor: ZStylingColor.nullish(),

  cardBackgroundColor: ZStylingColor.nullish(),
  cardBorderColor: ZStylingColor.nullish(),
  highlightBorderColor: ZStylingColor.nullish(),
  roundness: ZStylingDimension.nullish(),
  cardArrangement: ZCardArrangement.nullish(),
  linkSurveyCardWidth: ZLinkSurveyCardWidthOptions.nullish(),
  background: ZSurveyStylingBackground.nullish(),
  hideProgressBar: z.boolean().nullish(),
  isLogoHidden: z.boolean().nullish(),
  logo: ZLogo.nullish(),
});

export type TBaseStyling = z.infer<typeof ZBaseStyling>;
