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
  brandColor: ZStylingColor,
  questionColor: ZStylingColor,
  inputColor: ZStylingColor,
  inputBorderColor: ZStylingColor,
  cardBackgroundColor: ZStylingColor,
  highlightBorderColor: ZStylingColor.optional(),
  enableDarkMode: z.boolean(),
  roundness: z.number(),
  cardArrangement: ZCardArrangement,
});

export type TStyling = z.infer<typeof ZStyling>;
