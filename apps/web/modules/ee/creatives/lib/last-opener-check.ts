import { type QueryClient, queryOptions } from "@tanstack/react-query";
import type { CreativeResourceZodType } from "@formbricks/api-v3-schemas";
import { leavesSurveyUnopened } from "./survey-side";
import { openedSurveyFactsQuery, surveyLinkedCreativesQuery } from "./survey-side-api";

type TCreativeRef = Pick<CreativeResourceZodType, "id" | "destination">;

const readSurveyLeftUnopened = async (
  client: QueryClient,
  workspaceId: string,
  creative: TCreativeRef
): Promise<boolean> => {
  const { destination } = creative;
  if (destination?.type !== "survey") return false;
  const { surveyId } = destination;
  try {
    const [survey, linkedCreatives] = await Promise.all([
      client.fetchQuery({ ...openedSurveyFactsQuery(surveyId), staleTime: 0 }),
      client.fetchQuery({ ...surveyLinkedCreativesQuery({ workspaceId, surveyId }), staleTime: 0 }),
    ]);
    return leavesSurveyUnopened({ survey, linkedCreatives, creativeId: creative.id });
  } catch {
    // The change is allowed anyway: a read that fails just skips the confirmation.
    return false;
  }
};

/**
 * Before a creative stops opening its survey (archive, delete, relink): whether that leaves a live app
 * survey nothing opens (`leavesSurveyUnopened`), so the screen can confirm first. Read fresh each time
 * (`staleTime: 0`), through the survey and linked-creatives queries; the survey to name is the
 * creative's own `destination.surveyName`.
 */
export const surveyLeftUnopenedQuery = (workspaceId: string, creative: TCreativeRef) => {
  const surveyId = creative.destination?.type === "survey" ? creative.destination.surveyId : null;
  return queryOptions({
    queryKey: ["creatives", "leavesSurveyUnopened", creative.id, surveyId] as const,
    queryFn: ({ client }) => readSurveyLeftUnopened(client, workspaceId, creative),
    staleTime: 0,
  });
};

/** The name of the survey a creative opens, for the confirmation's copy. */
export const getOpenedSurveyName = (creative: TCreativeRef): string =>
  creative.destination?.type === "survey" ? creative.destination.surveyName : "";
