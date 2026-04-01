import { z } from "zod";

export const ZIntegrationBase = z.object({
  id: z.string(),
  environmentId: z.string(),
});

export const ZIntegrationBaseSurveyData = z.object({
  createdAt: z.date(),
  // questionIds: z.array(z.string()),
  elementIds: z.array(z.string()),
  includeVariables: z.boolean().optional(),
  includeHiddenFields: z.boolean().optional(),
  includeMetadata: z.boolean().optional(),
  includeCreatedAt: z.boolean().optional(),
  // questions: z.string(),
  elements: z.string(),
  surveyId: z.string(),
  surveyName: z.string(),
});
