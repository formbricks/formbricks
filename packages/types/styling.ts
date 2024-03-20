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
  inAppSurveys: ZCardArrangementOptions,
});

export const ZSurveyStylingBackground = z.object({
  bg: z.string().nullish(),
  bgType: z.enum(["animation", "color", "image"]).nullish(),
  brightness: z.number().nullish(),
});

export type TSurveyStylingBackground = z.infer<typeof ZSurveyStylingBackground>;

export const ZBaseStyling = z.object({
  brandColor: ZStylingColor.nullish(),
  questionColor: ZStylingColor.nullish(),
  inputColor: ZStylingColor.nullish(),
  inputBorderColor: ZStylingColor.nullish(),
  cardBackgroundColor: ZStylingColor.nullish(),
  cardBorderColor: ZStylingColor.nullish(),
  cardShadowColor: ZStylingColor.nullish(),
  highlightBorderColor: ZStylingColor.nullish(),
  isDarkModeEnabled: z.boolean().nullish(),
  roundness: z.number().nullish(),
  cardArrangement: ZCardArrangement.nullish(),
  background: ZSurveyStylingBackground.nullish(),
  hideProgressBar: z.boolean().nullish(),
});
