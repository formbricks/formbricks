import { z } from "zod";

export const ZLinkSurveyEmailData = z.object({
  surveyId: z.string(),
  email: z.string(),
  suId: z.string().optional(),
  surveyName: z.string(),
  locale: z.string(),
  logoUrl: z.string().optional(),
  isPreview: z.boolean().optional(),
});

export type TLinkSurveyEmailData = z.infer<typeof ZLinkSurveyEmailData>;
