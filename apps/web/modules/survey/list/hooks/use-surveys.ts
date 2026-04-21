"use client";

import { keepPreviousData, useInfiniteQuery } from "@tanstack/react-query";
import { flattenSurveyPages, surveyKeys } from "@/modules/survey/list/lib/query";
import { TSurveyOverviewFilters } from "@/modules/survey/list/types/survey-overview";
import { listSurveys } from "../lib/v3-surveys-client";

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

  const surveys = flattenSurveyPages(query.data);
  const totalCount = query.data?.pages[0]?.meta.totalCount ?? 0;

  return {
    ...query,
    queryKey,
    surveys,
    totalCount,
  };
};
