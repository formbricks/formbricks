import { z } from "zod";
import { ZLinkSurveySingleUseLinkParams } from "@/app/api/internal/link-survey-verification-emails/schemas";

/** A PIN is four digits; anything longer is bounded long before it is compared. */
export const LINK_SURVEY_PIN_MAX_LENGTH = 64;

/** `POST /api/internal/link-survey-pin-verifications`: the PIN typed on the PIN screen, and its link. */
export const ZLinkSurveyPinVerificationBody = z
  .object({
    surveyId: z.cuid2(),
    pin: z.string().max(LINK_SURVEY_PIN_MAX_LENGTH),
    // The single-use link the PIN screen was opened with, as it appears in the URL.
    ...ZLinkSurveySingleUseLinkParams,
  })
  .strict();

export type TLinkSurveyPinVerificationBody = z.infer<typeof ZLinkSurveyPinVerificationBody>;
