import { z } from "zod";
import { ZDocumentSentiment } from "@formbricks/types/documents";

export const ZStats = z.object({
  overallSentiment: ZDocumentSentiment,
  activeSurveys: z.number(),
  newResponses: z.number(),
  analysedFeedbacks: z.number(),
});

export type TStats = z.infer<typeof ZStats>;

export const ZStatsPeriod = z.enum(["all", "day", "week", "month", "quarter"]);
export type TStatsPeriod = z.infer<typeof ZStatsPeriod>;
