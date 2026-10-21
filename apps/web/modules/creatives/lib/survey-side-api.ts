import { queryOptions } from "@tanstack/react-query";
import type { CreativeResourceZodType } from "@formbricks/api-v3-schemas";
import { readCreativesApiData, requestCreativesApi } from "./creatives-api-client";
import { ACTIVE_CREATIVES_LIMIT } from "./list-api";
import type { TOpenedSurveyFacts, TSurveyLinkedCreative } from "./survey-side";

// The survey screens' calls to `/api/v3/creatives`: the creatives that open one survey, and pausing
// one when a resume keeps them paused. Their query keys live in the surveys' own query client.

export const surveyLinkedCreativesKeys = {
  all: ["creatives", "linkedToSurvey"] as const,
  survey: (surveyId: string) => [...surveyLinkedCreativesKeys.all, surveyId] as const,
};

/**
 * The survey's linked creatives, by name: the list leaves archived creatives out by default. One page
 * at the API's ceiling; no survey is expected to be opened by more.
 */
export const listSurveyLinkedCreatives = async ({
  workspaceId,
  surveyId,
  signal,
}: {
  workspaceId: string;
  surveyId: string;
  signal?: AbortSignal;
}): Promise<TSurveyLinkedCreative[]> => {
  const query = new URLSearchParams({
    workspaceId,
    surveyId,
    limit: String(ACTIVE_CREATIVES_LIMIT),
    sortBy: "name",
  });
  return readCreativesApiData<CreativeResourceZodType[]>(await requestCreativesApi({ query, signal }));
};

export const surveyLinkedCreativesQuery = ({
  workspaceId,
  surveyId,
}: Readonly<{ workspaceId: string; surveyId: string }>) =>
  queryOptions({
    queryKey: surveyLinkedCreativesKeys.survey(surveyId),
    queryFn: ({ signal }) => listSurveyLinkedCreatives({ workspaceId, surveyId, signal }),
  });

type TOpenedSurveyResource = Pick<TOpenedSurveyFacts, "type" | "status"> & {
  distribution?: { triggers?: unknown[] };
};

/** The survey a creative opens, as the last-creative warning reads it (`GET /api/v3/surveys/{id}`). */
export const openedSurveyFactsQuery = (surveyId: string) =>
  queryOptions({
    queryKey: ["creatives", "openedSurvey", surveyId] as const,
    queryFn: async ({ signal }): Promise<TOpenedSurveyFacts> => {
      const data = await readCreativesApiData<TOpenedSurveyResource>(
        await requestCreativesApi({ resource: "surveys", path: [surveyId], signal })
      );
      return { type: data.type, status: data.status, triggers: data.distribution?.triggers ?? [] };
    },
  });

/** Pauses the creative by its author's hand, so it stays paused whatever its survey does. */
export const pauseCreative = async (creativeId: string): Promise<void> => {
  await requestCreativesApi({ path: [creativeId], method: "PATCH", body: { status: "paused" } });
};
