import "server-only";
import { logger } from "@formbricks/logger";
import { type TLinkSurvey, getSurveyWithMetadata } from "@/modules/survey/link/lib/data";
import { isLinkSurveyServable } from "@/modules/survey/link/lib/public-access";

/**
 * Loads the survey behind a public link page (/s/<id>, /c/<token>) and returns it only when the page may
 * serve it at all: `null` for a missing or unloadable survey and for a draft, archived or non-link one.
 *
 * Pages take the survey from here, so they never hold a survey they must not serve. Any early return they
 * render (an invalid single-use link, "already responded") would otherwise confirm that a non-public survey
 * exists and show its workspace's branding (ENG-4032). A load failure is logged and treated as missing:
 * the respondent gets the same 404 either way, and the log tells an outage apart.
 */
export const getServableLinkSurvey = async (surveyId: string): Promise<TLinkSurvey | null> => {
  let survey: TLinkSurvey;
  try {
    survey = await getSurveyWithMetadata(surveyId);
  } catch (error) {
    logger.error(error, "Error fetching survey for a public link page");
    return null;
  }
  return isLinkSurveyServable(survey) ? survey : null;
};
