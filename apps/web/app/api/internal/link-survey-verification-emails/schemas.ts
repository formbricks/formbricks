import { z } from "zod";
import { ZLinkSurveyEmailData } from "@formbricks/types/email";
import { strictDeep } from "@/app/api/internal/lib/strict-schema";
import { SINGLE_USE_ID_MAX_LENGTH, SINGLE_USE_TOKEN_MAX_LENGTH } from "@/lib/utils/single-use-surveys";

/**
 * The survey language the respondent arrived with (`de-DE`, or a custom code). Resolved against the survey's
 * own languages before it is used, so this only bounds what the server is asked to compare.
 */
export const LINK_SURVEY_LANGUAGE_CODE_MAX_LENGTH = 256;

/**
 * The single-use link values, as the gate screens pass them through from the URL. They reach a decrypt and a
 * hash, so they are bounded to what a link we minted can carry before anything runs on them.
 */
export const ZLinkSurveySingleUseLinkParams = {
  suId: z.string().max(SINGLE_USE_ID_MAX_LENGTH).optional(),
  suToken: z.string().max(SINGLE_USE_TOKEN_MAX_LENGTH).optional(),
};

/**
 * `POST /api/internal/link-survey-verification-emails`: what the verify-email screen sends. Only what the
 * respondent chose: the survey's name and logo in the email are read on the server, never taken from here
 * (ENG-4043), and an unknown key is refused.
 */
export const ZLinkSurveyVerificationEmailBody = strictDeep(
  ZLinkSurveyEmailData.extend({
    ...ZLinkSurveySingleUseLinkParams,
    surveyLanguageCode: z.string().max(LINK_SURVEY_LANGUAGE_CODE_MAX_LENGTH).optional(),
  })
);

export type TLinkSurveyVerificationEmailBody = z.infer<typeof ZLinkSurveyVerificationEmailBody>;
