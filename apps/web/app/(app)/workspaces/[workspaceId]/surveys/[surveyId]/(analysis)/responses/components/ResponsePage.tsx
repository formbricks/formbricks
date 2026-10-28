"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { TSurveyQuota } from "@formbricks/types/quota";
import { TResponseWithQuotas } from "@formbricks/types/responses";
import { TSurvey } from "@formbricks/types/surveys/types";
import { TTag } from "@formbricks/types/tags";
import { TUser, TUserLocale } from "@formbricks/types/user";
import {
  getResponseCountAction,
  getResponsesAction,
} from "@/app/(app)/workspaces/[workspaceId]/surveys/[surveyId]/(analysis)/actions";
import { useResponseFilter } from "@/app/(app)/workspaces/[workspaceId]/surveys/[surveyId]/(analysis)/components/response-filter-context";
import { useResponseTableFilters } from "@/app/(app)/workspaces/[workspaceId]/surveys/[surveyId]/(analysis)/hooks/use-response-table-filters";
import { ResponseDataView } from "@/app/(app)/workspaces/[workspaceId]/surveys/[surveyId]/(analysis)/responses/components/ResponseDataView";
import { getFormattedFilters } from "@/app/lib/surveys/surveys";
import { getFormattedErrorMessage } from "@/lib/utils/error-message";

interface ResponsePageProps {
  survey: TSurvey;
  surveyId: string;
  user?: TUser;
  environmentTags: TTag[];
  responsesPerPage: number;
  locale: TUserLocale;
  isReadOnly: boolean;
  isQuotasAllowed: boolean;
  quotas: TSurveyQuota[];
  initialResponses?: TResponseWithQuotas[];
  /** Creatives open this survey: its table then shows "Opened by creative" by default. */
  isOpenedByCreatives: boolean;
}

export const ResponsePage = ({
  survey,
  surveyId,
  user,
  environmentTags,
  responsesPerPage,
  locale,
  isReadOnly,
  isQuotasAllowed,
  quotas,
  initialResponses = [],
  isOpenedByCreatives,
}: Readonly<ResponsePageProps>) => {
  const [responses, setResponses] = useState<TResponseWithQuotas[]>(initialResponses);
  const [page, setPage] = useState<number | null>(null);
  const [hasMore, setHasMore] = useState<boolean>(initialResponses.length >= responsesPerPage);
  const [isFetchingFirstPage, setIsFetchingFirstPage] = useState<boolean>(false);
  const { registerAnalysisRefreshHandler } = useResponseFilter();
  const filterState = useResponseTableFilters(survey);
  const { selectedFilter, dateRange } = filterState;
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const computedFilters = useMemo(
    () => getFormattedFilters(survey, selectedFilter, dateRange),

    [survey, selectedFilter, dateRange]
  );

  // `survey` is an RSC prop, so every `router.refresh()` (survey status dropdown, share modal, reset
  // survey) hands down a freshly deserialized object and `computedFilters` takes a new identity for
  // unchanged content. Memoized so the serialization happens when the filters actually recompute
  // rather than on every render of this page — each scroll fetch, each row or tag edit.
  const filtersKey = useMemo(() => JSON.stringify(computedFilters), [computedFilters]);

  // The identity everything downstream keys on, held steady while the filter *value* is unchanged.
  // Without it a refresh re-creates `fetchNextPage` and `refetchResponses`, which re-registers the
  // analysis refresh handler and would collapse the infinite-scroll list back to page 1.
  // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on the filter value, not its identity
  const filters = useMemo(() => computedFilters, [filtersKey]);
  const { isReady } = filterState;

  // The criteria the loaded list was fetched with. A refresh resolves relative dates afresh, so the
  // pages after it and the count must ask about the same window as its first page.
  const listCriteriaRef = useRef(filters);
  // Bumped by every first-page fetch; an answer that arrives after a newer one started is dropped, so
  // fast ticking cannot land an older filter's rows under newer chips.
  const firstPageRequestRef = useRef(0);

  // Rows matching the filters, for the toolbar. Refetched with the list, so a delete or a refresh
  // keeps it honest.
  const matchCountKey = ["surveys", surveyId, "response-count", filtersKey];
  const matchCountQuery = useQuery({
    queryKey: matchCountKey,
    queryFn: async () => (await getResponseCountAction({ surveyId, filterCriteria: filters }))?.data ?? null,
    enabled: isReady,
  });
  const { refetch: refetchMatchCount } = matchCountQuery;

  const fetchNextPage = useCallback(async () => {
    if (page === null || !isReady) return;
    const newPage = page + 1;

    let newResponses: TResponseWithQuotas[] = [];

    const getResponsesActionResponse = await getResponsesAction({
      surveyId,
      limit: responsesPerPage,
      offset: (newPage - 1) * responsesPerPage,
      filterCriteria: listCriteriaRef.current,
    });
    newResponses = getResponsesActionResponse?.data || [];

    if (newResponses.length === 0 || newResponses.length < responsesPerPage) {
      setHasMore(false);
    }
    setResponses([...responses, ...newResponses]);
    setPage(newPage);
  }, [isReady, page, responses, responsesPerPage, surveyId]);

  const updateResponseList = (responseIds: string[]) => {
    setResponses((prev) => prev.filter((r) => !responseIds.includes(r.id)));
    void refetchMatchCount();
  };

  const updateResponse = (responseId: string, updatedResponse: TResponseWithQuotas) => {
    setResponses((prev) => prev.map((r) => (r.id === responseId ? updatedResponse : r)));
  };

  const refetchResponses = useCallback(async () => {
    if (!isReady) return;
    setIsFetchingFirstPage(true);
    const requestId = ++firstPageRequestRef.current;

    try {
      // A refresh asks about now: a relative date window may have moved on since the filter was set.
      const criteria = filterState.resolveFreshCriteria();
      const getResponsesActionResponse = await getResponsesAction({
        surveyId,
        limit: responsesPerPage,
        offset: 0,
        filterCriteria: criteria,
      });
      if (requestId !== firstPageRequestRef.current) return;
      listCriteriaRef.current = criteria;
      // The count answers for the same window as the refreshed page.
      void getResponseCountAction({ surveyId, filterCriteria: criteria }).then((count) =>
        queryClient.setQueryData(matchCountKey, count?.data ?? null)
      );

      if (getResponsesActionResponse?.serverError) {
        toast.error(getFormattedErrorMessage(getResponsesActionResponse) ?? t("common.something_went_wrong"));
      }

      const freshResponses = getResponsesActionResponse?.data ?? [];
      setResponses(freshResponses);
      setPage(1);
      setHasMore(freshResponses.length >= responsesPerPage);
    } finally {
      setIsFetchingFirstPage(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `matchCountKey` is rebuilt from `filtersKey`
  }, [filterState.resolveFreshCriteria, filtersKey, isReady, queryClient, responsesPerPage, surveyId, t]);

  useEffect(() => {
    return registerAnalysisRefreshHandler(refetchResponses);
  }, [refetchResponses, registerAnalysisRefreshHandler]);

  // Only fetch if filters are applied (not on initial mount with no filters)
  const hasFilters =
    selectedFilter?.responseStatus !== "all" ||
    (selectedFilter?.filter && selectedFilter.filter.length > 0) ||
    (dateRange.from && dateRange.to);

  useEffect(() => {
    const fetchFilteredResponses = async () => {
      // skip call for initial mount
      if (page === null && !hasFilters) {
        setPage(1);
        return;
      }
      setPage(1);
      setIsFetchingFirstPage(true);
      const requestId = ++firstPageRequestRef.current;
      // The server rendered the unfiltered list; it stays behind the loading state until the rules in
      // the URL can be resolved.
      if (!isReady) return;

      try {
        const getResponsesActionResponse = await getResponsesAction({
          surveyId,
          limit: responsesPerPage,
          offset: 0,
          filterCriteria: filters,
        });
        if (requestId !== firstPageRequestRef.current) return;
        listCriteriaRef.current = filters;

        const responses = getResponsesActionResponse?.data || [];
        setHasMore(responses.length >= responsesPerPage);
        setResponses(responses);
      } finally {
        if (requestId === firstPageRequestRef.current) setIsFetchingFirstPage(false);
      }
    };
    fetchFilteredResponses();
    // page is intentionally omitted to avoid refetching after the initial page setup.
    // hasFilters is derived from selectedFilter/dateRange which are already deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- effect must run only when the filter value changes, not on page updates it sets internally
  }, [filtersKey, isReady, responsesPerPage, selectedFilter, dateRange, surveyId]);

  return (
    <ResponseDataView
      survey={survey}
      responses={responses}
      user={user}
      environmentTags={environmentTags}
      isReadOnly={isReadOnly}
      fetchNextPage={fetchNextPage}
      hasMore={hasMore}
      updateResponseList={updateResponseList}
      updateResponse={updateResponse}
      isFetchingFirstPage={isFetchingFirstPage}
      locale={locale}
      isQuotasAllowed={isQuotasAllowed}
      quotas={quotas}
      isOpenedByCreatives={isOpenedByCreatives}
      toolbar={{ filterState, matchCount: matchCountQuery.data ?? null }}
    />
  );
};
