import { z } from "zod";

export const ZStats = z.object({
  overallSentiment: z.string().optional(),
  activeSurveys: z.number(),
  newResponses: z.number(),
  analysedFeedbacks: z.number(),
});

export type TStats = z.infer<typeof ZStats>;

export const ZStatsPeriod = z.enum(["all", "day", "week", "month", "quarter"]);
export type TStatsPeriod = z.infer<typeof ZStatsPeriod>;
