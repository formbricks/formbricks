import { z } from "zod";
import { ZPerson } from "./people";

export const ZDisplay = z.object({
  id: z.string().cuid2(),
  createdAt: z.date(),
  updatedAt: z.date(),
  surveyId: z.string().cuid2(),
  person: ZPerson.nullable(),
  responseId: z.string().cuid2().nullable(),
  status: z.enum(["seen", "responded"]),
});

export type TDisplay = z.infer<typeof ZDisplay>;

export const ZDisplayInput = z.object({
  surveyId: z.string().cuid2(),
  personId: z.string().cuid2().optional(),
});

export type TDisplayInput = z.infer<typeof ZDisplayInput>;

export const ZDisplaysWithSurveyName = ZDisplay.extend({
  surveyName: z.string(),
});

export type TDisplaysWithSurveyName = z.infer<typeof ZDisplaysWithSurveyName>;
