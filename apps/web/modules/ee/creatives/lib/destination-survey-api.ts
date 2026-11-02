import { keepPreviousData, queryOptions } from "@tanstack/react-query";
import type { TSurveyStatus, TSurveyType, TSurveyVisibility } from "@formbricks/types/surveys/types";
import { readCreativesApiData, requestCreativesApi } from "./creatives-api-client";
import type { TDestinationSurveyOption } from "./destination-options";
import type { TLanguageCheckSurvey } from "./languages-form";

/**
 * The editor's reads of the surveys a creative can open, through the surveys' own v3 endpoints: the On
 * click picker searches `GET /api/v3/surveys` by name, and the chosen survey's languages come from
 * `GET /api/v3/surveys/{id}`. Both answer only with surveys the editor can read (ENG-3868).
 */

/** One page of results: enough to scan, and the search finds the rest. */
export const DESTINATION_SURVEY_PAGE_SIZE = 50;

export const destinationSurveyKeys = {
  all: ["creatives", "destinationSurveys"] as const,
  search: (workspaceId: string, search: string) =>
    [...destinationSurveyKeys.all, workspaceId, "search", search] as const,
  languages: (surveyId: string) => [...destinationSurveyKeys.all, "languages", surveyId] as const,
};

/**
 * The picker's list request: either survey type, none that is single-use or PIN-protected (archived ones
 * are left out by default), running surveys first, then the most recently updated.
 */
export const buildDestinationSurveySearchQuery = (workspaceId: string, search: string): URLSearchParams => {
  const query = new URLSearchParams({
    workspaceId,
    limit: String(DESTINATION_SURVEY_PAGE_SIZE),
    includeTotalCount: "false",
    "filter[type][in]": "app,link",
    "filter[singleUse][eq]": "false",
    "filter[pinProtected][eq]": "false",
    sortBy: "relevance",
  });
  if (search) query.set("filter[name][contains]", search);
  return query;
};

type TV3SurveyListItem = {
  id: string;
  name: string;
  type: TSurveyType;
  status: TSurveyStatus;
  visibility: TSurveyVisibility;
};

export const toDestinationSurveyOption = ({
  id,
  name,
  type,
  status,
  visibility,
}: TV3SurveyListItem): TDestinationSurveyOption => ({ id, name, type, status, visibility });

export const destinationSurveySearchQuery = ({
  workspaceId,
  search,
}: Readonly<{ workspaceId: string; search: string }>) =>
  queryOptions({
    queryKey: destinationSurveyKeys.search(workspaceId, search),
    queryFn: async ({ signal }): Promise<TDestinationSurveyOption[]> => {
      const items = await readCreativesApiData<TV3SurveyListItem[]>(
        await requestCreativesApi({
          resource: "surveys",
          query: buildDestinationSurveySearchQuery(workspaceId, search),
          signal,
        })
      );
      return items.map(toDestinationSurveyOption);
    },
    // The previous results stay while the next search loads, so the list doesn't flash empty.
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });

type TV3SurveyLanguage = { code: string; default: boolean; enabled: boolean; alias?: string };

/**
 * `GET /api/v3/surveys/{id}` reports a survey that was never translated as a single `en-US` default
 * language, the same answer as one translated into English alone. The editor can't tell the two apart,
 * so it reads that answer as unknown, as it does for any untranslated survey, rather than warn every
 * non-English creative that a survey written in its own language lacks it.
 */
const isUntranslatedFallback = (languages: readonly TV3SurveyLanguage[]): boolean =>
  languages.length === 1 &&
  languages[0].code === "en-US" &&
  languages[0].default &&
  languages[0].enabled &&
  !languages[0].alias;

/** A survey's languages as the creative's language check matches them; `undefined` when unknown. */
export const toLanguageCheckLanguages = (
  languages: readonly TV3SurveyLanguage[]
): TLanguageCheckSurvey["languages"] | undefined =>
  isUntranslatedFallback(languages)
    ? undefined
    : languages.map(({ code, default: isDefault, enabled, alias }) => ({
        default: isDefault,
        enabled,
        language: { code, alias: alias ?? null },
      }));

export const destinationSurveyLanguagesQuery = (surveyId: string) =>
  queryOptions({
    queryKey: destinationSurveyKeys.languages(surveyId),
    queryFn: async ({ signal }) => {
      const survey = await readCreativesApiData<{ languages: TV3SurveyLanguage[] }>(
        await requestCreativesApi({ resource: "surveys", path: [surveyId], signal })
      );
      // `null`, not `undefined`: a query can't resolve to `undefined`.
      return toLanguageCheckLanguages(survey.languages) ?? null;
    },
    staleTime: 30_000,
  });
