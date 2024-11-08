import { z } from "zod";

export const ZStats = z.object({
  sentimentScore: z.number().optional(),
  overallSentiment: z.enum(["positive", "negative", "neutral"]).optional(),
  activeSurveys: z.number(),
  newResponses: z.number(),
  analysedFeedbacks: z.number(),
});

export type TStats = z.infer<typeof ZStats>;

export const ZStatsPeriod = z.enum(["all", "day", "week", "month", "quarter"]);
export type TStatsPeriod = z.infer<typeof ZStatsPeriod>;
