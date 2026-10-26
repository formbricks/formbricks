import { z } from "zod";
import { ZId } from "./common";
import { ZUserEmail, ZUserLocale } from "./user";

// What the public verify-email screen sends. The action behind it runs without a session, so this
// carries only what the respondent chose: the survey's name and logo in the email are read on the
// server, never taken from here (ENG-4043).
export const ZLinkSurveyEmailData = z.object({
  surveyId: ZId,
  email: ZUserEmail,
  suId: z.string().optional(),
  suToken: z.string().optional(),
  // The language the email's own copy is rendered in.
  locale: ZUserLocale,
  // The survey language the respondent arrived with, as stored on the survey (e.g. "de-DE"). Carried
  // back into the emailed link as `?lang=` so passing the gate does not drop the requested language.
  // Absent when the respondent made no explicit choice, so the link stays on the survey default.
  surveyLanguageCode: z.string().optional(),
});

export type TLinkSurveyEmailData = z.infer<typeof ZLinkSurveyEmailData>;

// The respondent's request plus what the server adds from the survey and its organization.
export type TVerifiedLinkSurveyEmailData = TLinkSurveyEmailData & {
  surveyName: string;
  logoUrl?: string;
};
