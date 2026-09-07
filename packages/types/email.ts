import { z } from "zod";
import { ZStorageUrl } from "./common";
import { ZUserLocale } from "./user";

export const ZLinkSurveyEmailData = z.object({
  surveyId: z.string(),
  email: z.string(),
  suId: z.string().optional(),
  suToken: z.string().optional(),
  surveyName: z.string(),
  // The language the email's own copy is rendered in.
  locale: ZUserLocale,
  // The survey language the respondent arrived with, as stored on the survey (e.g. "de-DE"). Carried
  // back into the emailed link as `?lang=` so passing the gate does not drop the requested language.
  // Absent when the respondent made no explicit choice, so the link stays on the survey default.
  surveyLanguageCode: z.string().optional(),
  logoUrl: ZStorageUrl.optional(),
});

export type TLinkSurveyEmailData = z.infer<typeof ZLinkSurveyEmailData>;
