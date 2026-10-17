import type { CreativeResourceZodType } from "@formbricks/api-v3-schemas";
import { leavesSurveyUnopened } from "./survey-side";
import { getOpenedSurveyFacts, listSurveyLinkedCreatives } from "./survey-side-api";

type TCreativeRef = Pick<CreativeResourceZodType, "id" | "destination">;

/**
 * Before a creative stops opening its survey (archive, delete, relink): the survey's name when that
 * leaves a live app survey nothing opens (`leavesSurveyUnopened`), so the screen can confirm first, or
 * `null`. Read fresh at that moment; a read that fails says nothing, since the change is allowed anyway.
 */
export const findSurveyLeftUnopened = async (
  workspaceId: string,
  creative: TCreativeRef
): Promise<string | null> => {
  const { destination } = creative;
  if (destination?.type !== "survey") return null;
  try {
    const [survey, linkedCreatives] = await Promise.all([
      getOpenedSurveyFacts(destination.surveyId),
      listSurveyLinkedCreatives({ workspaceId, surveyId: destination.surveyId }),
    ]);
    return leavesSurveyUnopened({ survey, linkedCreatives, creativeId: creative.id })
      ? destination.surveyName
      : null;
  } catch {
    return null;
  }
};
