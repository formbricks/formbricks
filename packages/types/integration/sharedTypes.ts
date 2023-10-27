import { z } from "zod";
export * from "./sharedTypes";

export const ZIntegrationBase = z.object({
  id: z.string(),
  environmentId: z.string(),
});

export const ZIntegrationBaseSurveyData = z.object({
  createdAt: z.date(),
  questionIds: z.array(z.string()).optional(),
  questions: z.string().optional(),
  surveyId: z.string(),
  surveyName: z.string(),
});
