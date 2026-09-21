interface VerifiedLinkSurveyUrlParams {
  publicDomain: string;
  surveyId: string;
  /** Verification token minted for the respondent's email address. */
  token: string;
  singleUseId?: string;
  singleUseToken?: string;
  /** Survey language the respondent arrived with; omitted when they made no explicit choice. */
  surveyLanguageCode?: string;
}

/**
 * Builds the survey link that goes into the email-verification email.
 *
 * Every parameter the respondent needs to land where they left off is set here, in one place:
 * `verify` always, `suId`/`suToken` for single-use links, and `lang` when the respondent picked a
 * language — without it the emailed link drops back to the survey default (ENG-2584).
 */
export const buildVerifiedLinkSurveyUrl = ({
  publicDomain,
  surveyId,
  token,
  singleUseId,
  singleUseToken,
  surveyLanguageCode,
}: VerifiedLinkSurveyUrlParams): string => {
  const surveyLink = new URL(`${publicDomain}/s/${surveyId}`);
  surveyLink.searchParams.set("verify", token);

  if (singleUseId) {
    surveyLink.searchParams.set("suId", singleUseId);
    if (singleUseToken) {
      surveyLink.searchParams.set("suToken", singleUseToken);
    }
  }

  // "default" is the survey's own default language, which is what a link with no `lang` already
  // resolves to — so it is left off rather than pinned into the URL.
  if (surveyLanguageCode && surveyLanguageCode !== "default") {
    surveyLink.searchParams.set("lang", surveyLanguageCode);
  }

  return surveyLink.toString();
};
