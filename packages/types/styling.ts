import { z } from "zod";
import { ZColor } from "./common";

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
  questionColor: ZStylingColor.nullish(),
  inputColor: ZStylingColor.nullish(),
  inputBorderColor: ZStylingColor.nullish(),
  cardBackgroundColor: ZStylingColor.nullish(),
  cardBorderColor: ZStylingColor.nullish(),
  highlightBorderColor: ZStylingColor.nullish(),
  isDarkModeEnabled: z.boolean().nullish(),
  roundness: z.number().nullish(),
  cardArrangement: ZCardArrangement.nullish(),
  background: ZSurveyStylingBackground.nullish(),
  hideProgressBar: z.boolean().nullish(),
  isLogoHidden: z.boolean().nullish(),
});

export type TBaseStyling = z.infer<typeof ZBaseStyling>;
