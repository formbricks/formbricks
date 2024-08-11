import { z } from "zod";

export const ZLinkSurveyEmailData = z.object({
  surveyId: z.string(),
  email: z.string(),
  suId: z.string().optional(),
  surveyData: z
    .object({
      name: z.string().optional(),
      subheading: z.string().optional(),
    })
    .optional(),
});

export type TLinkSurveyEmailData = z.infer<typeof ZLinkSurveyEmailData>;
