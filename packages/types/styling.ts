import { z } from "zod";

import { ZColor } from "./common";

export const ZStylingColor = z.object({
  light: ZColor,
  dark: ZColor.optional(),
});
export type TStylingColor = z.infer<typeof ZStylingColor>;

export const ZCardArrangementOptions = z.enum(["casual", "straight", "simple"]);
export type TCardArrangementOptions = z.infer<typeof ZCardArrangementOptions>;

export const ZCardArrangement = z.object({
  linkSurveys: ZCardArrangementOptions,
  inAppSurveys: ZCardArrangementOptions,
});

export const ZBaseStyling = z.object({
  brandColor: ZStylingColor.optional(),
  questionColor: ZStylingColor.optional(),
  inputColor: ZStylingColor.optional(),
  inputBorderColor: ZStylingColor.optional(),
  cardBackgroundColor: ZStylingColor.optional(),
  highlightBorderColor: ZStylingColor.optional(),
  isDarkModeEnabled: z.boolean().optional(),
  roundness: z.number().optional(),
  cardArrangement: ZCardArrangement.optional(),
});

export const ZProductStyling = ZBaseStyling.extend({
  unifiedStyling: z.boolean(),
  allowStyleOverwrite: z.boolean(),
});

export type TProductStyling = z.infer<typeof ZProductStyling>;
