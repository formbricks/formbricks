import { z } from "zod";

export const ZDisplay = z.object({
  id: z.string().cuid2(),
  createdAt: z.date(),
  updatedAt: z.date(),
  personId: z.string().cuid2().nullable(),
  surveyId: z.string().cuid2(),
  responseId: z.string().cuid2().nullable(),
  status: z.enum(["seen", "responded"]).nullable(),
});

export type TDisplay = z.infer<typeof ZDisplay>;

export const ZDisplayCreateInput = z.object({
  environmentId: z.string().cuid2(),
  surveyId: z.string().cuid2(),
  userId: z.string().optional(),
  responseId: z.string().cuid2().optional(),
});

export type TDisplayCreateInput = z.infer<typeof ZDisplayCreateInput>;

export const ZDisplayUpdateInput = z.object({
  environmentId: z.string().cuid2(),
  userId: z.string().optional(),
  responseId: z.string().cuid2().optional(),
});

export type TDisplayUpdateInput = z.infer<typeof ZDisplayUpdateInput>;

export const ZDisplaysWithSurveyName = ZDisplay.extend({
  surveyName: z.string(),
});

export type TDisplaysWithSurveyName = z.infer<typeof ZDisplaysWithSurveyName>;

export const ZDisplayFilters = z.object({
  createdAt: z
    .object({
      min: z.date().optional(),
      max: z.date().optional(),
    })
    .optional(),
  responseIds: z.array(z.string().cuid2()).optional(),
});

export type TDisplayFilters = z.infer<typeof ZDisplayFilters>;
