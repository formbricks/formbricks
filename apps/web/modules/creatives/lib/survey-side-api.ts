import { queryOptions } from "@tanstack/react-query";
import type { CreativeResourceZodType } from "@formbricks/api-v3-schemas";
import { parseV3ApiError } from "@/modules/api/lib/v3-client";
import { ACTIVE_CREATIVES_LIMIT } from "./list-api";
import type { TSurveyLinkedCreative } from "./survey-side";

// The survey screens' calls to `/api/v3/creatives`: the creatives that open one survey, and pausing
// one when a resume keeps them paused. Their query keys live in the surveys' own query client.

// Bounds a stalled pause so the resume dialog's pending state can't hang.
const MUTATION_TIMEOUT_MS = 15_000;

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
  const params = new URLSearchParams({
    workspaceId,
    surveyId,
    limit: String(ACTIVE_CREATIVES_LIMIT),
    sortBy: "name",
  });
  const response = await fetch(`/api/v3/creatives?${params.toString()}`, {
    method: "GET",
    cache: "no-store",
    signal,
  });
  if (!response.ok) throw await parseV3ApiError(response);
  return ((await response.json()) as { data: CreativeResourceZodType[] }).data;
};

export const surveyLinkedCreativesQuery = ({
  workspaceId,
  surveyId,
}: Readonly<{ workspaceId: string; surveyId: string }>) =>
  queryOptions({
    queryKey: surveyLinkedCreativesKeys.survey(surveyId),
    queryFn: ({ signal }) => listSurveyLinkedCreatives({ workspaceId, surveyId, signal }),
  });

/** Pauses the creative by its author's hand, so it stays paused whatever its survey does. */
export const pauseCreative = async (creativeId: string): Promise<void> => {
  const response = await fetch(`/api/v3/creatives/${creativeId}`, {
    method: "PATCH",
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status: "paused" }),
    signal: AbortSignal.timeout(MUTATION_TIMEOUT_MS),
  });
  if (!response.ok) throw await parseV3ApiError(response);
};
