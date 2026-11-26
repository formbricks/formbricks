import "server-only";
import { ResourceNotFoundError } from "@formbricks/types/errors";
import { type TLinkSurvey, getSurveyWithMetadata } from "@/modules/survey/link/lib/data";
import { isLinkSurveyOpenForResponses } from "@/modules/survey/link/lib/public-access";
import type { TSingleUseLinkSurface } from "@/modules/survey/link/lib/single-use-link-metrics";
import { getUnansweredLinkSurveySingleUseAccess } from "@/modules/survey/link/lib/single-use-unanswered";

/**
 * Loads the survey behind one of the link page's public gate routes (the PIN check and the verify-email
 * request), or `null` when it is "not found". Both run without a session, so a survey respondents cannot take
 * right now (a draft, archived, non-link, paused, scheduled or completed one) is "not found" here, before
 * anything else is checked, with the same answer as an unknown id. The page shows these as a 404 or as their
 * inactive screen, never their definition (ENG-4032).
 *
 * A single-use survey reached without a valid single-use link is "not found" too, the same way: the page
 * shows it only as "this survey can only be taken by invitation" (ENG-4041). So is one reached through a link
 * that has already been answered, which the page shows only as "already answered": a used link stays valid,
 * and would otherwise keep fetching the survey for whoever holds it. `suId` / `suToken` are the link's raw URL
 * values, which the gate screens pass through.
 *
 * What this does not hide: a valid unanswered link costs one more query than a forged link or an unknown id,
 * so the three can still be told apart by latency, as the page and its metadata can. And `/c` also shows
 * "response submitted" for a contact who already answered, which these routes can't mirror: they have no
 * contact to check (the PIN screen holds a contact id, but a client-supplied one can't be trusted, and a
 * caller who wants the definition just leaves it out). That is no extra exposure, since the same PIN opens
 * the survey on `/s/<id>`.
 */
export const getLinkSurveyOpenForResponses = async ({
  surveyId,
  suId,
  suToken,
  surface,
}: {
  surveyId: string;
  suId?: string;
  suToken?: string;
  surface: TSingleUseLinkSurface;
}): Promise<TLinkSurvey | null> => {
  let survey: TLinkSurvey;
  try {
    survey = await getSurveyWithMetadata(surveyId);
  } catch (error) {
    if (error instanceof ResourceNotFoundError) return null;
    throw error;
  }
  if (!isLinkSurveyOpenForResponses(survey)) return null;

  const singleUse = await getUnansweredLinkSurveySingleUseAccess({ survey, suId, suToken, surface });
  return singleUse.allowed ? survey : null;
};
