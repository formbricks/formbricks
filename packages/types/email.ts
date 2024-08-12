import { z } from "zod";

export const ZLinkSurveyEmailData = z.object({
  surveyId: z.string(),
  email: z.string(),
  suId: z.string().optional(),
  surveyName: z.string(),
});

export type TLinkSurveyEmailData = z.infer<typeof ZLinkSurveyEmailData>;
