"use client";

import { keepPreviousData, useInfiniteQuery } from "@tanstack/react-query";
import { flattenSurveyPages, surveyKeys } from "@/modules/survey/list/lib/query";
import { TSurveyOverviewFilters } from "@/modules/survey/list/types/survey-overview";
import { listSurveys } from "../lib/v3-surveys-client";
import { usePendingSurveyRemovals } from "./use-pending-survey-removals";

export const useSurveys = ({
  workspaceId,
  limit,
  filters,
  enabled = true,
}: {
  workspaceId: string;
  limit: number;
  filters: TSurveyOverviewFilters;
  enabled?: boolean;
}) => {
  const queryKey = surveyKeys.list({
    workspaceId,
    limit,
    filters,
  });

  const query = useInfiniteQuery({
    queryKey,
    initialPageParam: null as string | null,
    enabled,
    placeholderData: keepPreviousData,
    queryFn: ({ pageParam, signal }) =>
      listSurveys({
        workspaceId,
        limit,
        cursor: pageParam,
        includeTotalCount: pageParam === null,
        filters,
        signal,
      }),
    getNextPageParam: (lastPage) => lastPage.meta.nextCursor ?? undefined,
  });

  // A survey being archived, restored or deleted stays out of the list for the whole operation, even
  // if a refetch lands first and writes it back into the cache (ENG-2583).
  const pendingRemovals = usePendingSurveyRemovals();
  const surveys = flattenSurveyPages(query.data).filter((survey) => !pendingRemovals.includes(survey.id));
  // Read from page one: cursor pages are requested with includeTotalCount=false and carry null.
  const workspaceSurveyCount = query.data?.pages[0]?.meta.workspaceSurveyCount ?? null;

  return {
    ...query,
    queryKey,
    surveys,
    workspaceSurveyCount,
  };
};
