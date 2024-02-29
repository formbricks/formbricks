import { z } from "zod";

import { ZColor } from "./common";

export const ZStylingColor = z.object({
  light: ZColor,
  dark: ZColor.optional(),
});

export const ZCardArrangementOptions = z.enum(["casual", "straight", "simple"]);

export const ZCardArrangement = z.object({
  linkSurveys: ZCardArrangementOptions,
  inAppSurveys: ZCardArrangementOptions,
});

export const ZStyling = z.object({
  unifiedStyling: z.boolean(),
  allowStyleOverwrite: z.boolean(),
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

export type TStyling = z.infer<typeof ZStyling>;
