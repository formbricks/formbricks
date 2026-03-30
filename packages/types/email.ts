import { z } from "zod";
import { ZStorageUrl } from "./common";
import { ZUserLocale } from "./user";

export const ZLinkSurveyEmailData = z.object({
  surveyId: z.string(),
  email: z.string(),
  suId: z.string().optional(),
  surveyName: z.string(),
  locale: ZUserLocale,
  logoUrl: ZStorageUrl.optional(),
});

export type TLinkSurveyEmailData = z.infer<typeof ZLinkSurveyEmailData>;
