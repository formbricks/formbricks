import { queryOptions } from "@tanstack/react-query";
import { readCreativesApiData, requestCreativesApi } from "./creatives-api-client";
import { ACTIVE_CREATIVES_LIMIT, type TCreativeListPage } from "./list-api";
import type { TOpenedSurveyFacts, TSurveyLinkedCreative } from "./survey-side";

// The survey screens' calls to `/api/v3/creatives`: the creatives that open one survey, and pausing
// them when a resume keeps them paused. Their query keys live in the surveys' own query client.

export const surveyLinkedCreativesKeys = {
  all: ["creatives", "linkedToSurvey"] as const,
  survey: (surveyId: string) => [...surveyLinkedCreativesKeys.all, surveyId] as const,
};

/**
 * The most pages of linked creatives one read follows: 40 × 250 = 10 000 creatives on one survey, the
 * ceiling the survey-side unlink keeps too (`MAX_UNLINK_PAGES`). A survey opened by more makes the read
 * fail rather than return some of them: a status change names every creative it affects.
 */
export const MAX_LINKED_CREATIVE_PAGES = 40;

/**
 * The survey's linked creatives, by name: the list leaves archived creatives out by default. Every page,
 * so a status change names all of them rather than the first page's.
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
  const creatives: TSurveyLinkedCreative[] = [];
  let cursor: string | null = null;
  for (let page = 0; page < MAX_LINKED_CREATIVE_PAGES; page++) {
    const query = new URLSearchParams({
      workspaceId,
      surveyId,
      limit: String(ACTIVE_CREATIVES_LIMIT),
      sortBy: "name",
    });
    if (cursor) query.set("cursor", cursor);
    const { data, meta } = (await (await requestCreativesApi({ query, signal })).json()) as TCreativeListPage;
    creatives.push(...data);
    if (!meta.nextCursor) return creatives;
    cursor = meta.nextCursor;
  }
  throw new Error(
    `Survey ${surveyId} is opened by more than ${MAX_LINKED_CREATIVE_PAGES * ACTIVE_CREATIVES_LIMIT} creatives`
  );
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

/**
 * Pauses, by their author's hand, every In progress creative the survey opens, so they stay paused
 * whatever the survey does. One request however many there are: one PATCH each would run into the
 * API's 100 requests a minute.
 */
export const pauseSurveyCreatives = async ({
  workspaceId,
  surveyId,
}: Readonly<{ workspaceId: string; surveyId: string }>): Promise<void> => {
  await requestCreativesApi({ path: ["pause"], method: "POST", body: { workspaceId, surveyId } });
};
