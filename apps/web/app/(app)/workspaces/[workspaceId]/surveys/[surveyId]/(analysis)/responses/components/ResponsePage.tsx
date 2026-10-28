"use client";

import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { TSurveyQuota } from "@formbricks/types/quota";
import { TResponseWithQuotas } from "@formbricks/types/responses";
import { TSurvey } from "@formbricks/types/surveys/types";
import { TTag } from "@formbricks/types/tags";
import { TUser, TUserLocale } from "@formbricks/types/user";
import { getResponsesAction } from "@/app/(app)/workspaces/[workspaceId]/surveys/[surveyId]/(analysis)/actions";
import { useResponseFilter } from "@/app/(app)/workspaces/[workspaceId]/surveys/[surveyId]/(analysis)/components/response-filter-context";
import { ResponseDataView } from "@/app/(app)/workspaces/[workspaceId]/surveys/[surveyId]/(analysis)/responses/components/ResponseDataView";
import { CustomFilter } from "@/app/(app)/workspaces/[workspaceId]/surveys/[surveyId]/components/CustomFilter";
import { getFormattedFilters } from "@/app/lib/surveys/surveys";
import { getFormattedErrorMessage } from "@/lib/utils/error-message";
import { replaceHeadlineRecall } from "@/lib/utils/recall";
import { OutcomeQueryClientProvider } from "@/modules/analysis/response-outcome/components/outcome-query-client-provider";
import {
  type TOutcomeActions,
  type TOutcomeChanges,
  patchOutcomes,
  shouldDropAfterOutcome,
} from "@/modules/analysis/response-outcome/lib/outcome";

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
  const { selectedFilter, dateRange, resetState, registerAnalysisRefreshHandler } = useResponseFilter();
  const { t } = useTranslation();
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

  const searchParams = useSearchParams();

  const fetchNextPage = useCallback(async () => {
    if (page === null) return;
    const newPage = page + 1;

    let newResponses: TResponseWithQuotas[] = [];

    const getResponsesActionResponse = await getResponsesAction({
      surveyId,
      limit: responsesPerPage,
      offset: (newPage - 1) * responsesPerPage,
      filterCriteria: filters,
    });
    newResponses = getResponsesActionResponse?.data || [];

    if (newResponses.length === 0 || newResponses.length < responsesPerPage) {
      setHasMore(false);
    }
    setResponses([...responses, ...newResponses]);
    setPage(newPage);
  }, [filters, page, responses, responsesPerPage, surveyId]);

  const updateResponseList = (responseIds: string[]) => {
    setResponses((prev) => prev.filter((r) => !responseIds.includes(r.id)));
  };

  const updateResponse = (responseId: string, updatedResponse: TResponseWithQuotas) => {
    setResponses((prev) => prev.map((r) => (r.id === responseId ? updatedResponse : r)));
  };

  // Patches the page's own list. Stable, so the table and the card do not re-render for it.
  const applyOutcomes = useCallback((changes: TOutcomeChanges) => {
    setResponses((prev) => patchOutcomes(prev, changes));
  }, []);

  const responseStatus = selectedFilter.responseStatus;
  const outcomeActions: TOutcomeActions = useMemo(
    () => ({
      applyOutcomes,
      // A restored response no longer matches a Low quality filter, so it leaves the list.
      onSaved: (ids, outcome) => {
        if (shouldDropAfterOutcome(responseStatus, outcome)) {
          setResponses((prev) => prev.filter((r) => !ids.includes(r.id)));
        }
      },
    }),
    [applyOutcomes, responseStatus]
  );

  const refetchResponses = useCallback(async () => {
    setIsFetchingFirstPage(true);

    try {
      const getResponsesActionResponse = await getResponsesAction({
        surveyId,
        limit: responsesPerPage,
        offset: 0,
        filterCriteria: filters,
      });

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
  }, [filters, responsesPerPage, surveyId, t]);

  useEffect(() => {
    return registerAnalysisRefreshHandler(refetchResponses);
  }, [refetchResponses, registerAnalysisRefreshHandler]);

  const surveyMemoized = useMemo(() => {
    return replaceHeadlineRecall(survey, "default");
  }, [survey]);

  useEffect(() => {
    if (!searchParams?.get("referer")) {
      resetState();
    }
  }, [searchParams, resetState]);

  // Only fetch if filters are applied (not on initial mount with no filters)
  const hasFilters =
    selectedFilter?.responseStatus !== "all" ||
    (selectedFilter?.filter && selectedFilter.filter.length > 0) ||
    (dateRange.from && dateRange.to);

  useEffect(() => {
    const fetchFilteredResponses = async () => {
      try {
        // skip call for initial mount
        if (page === null && !hasFilters) {
          setPage(1);
          return;
        }
        setPage(1);
        setIsFetchingFirstPage(true);
        let responses: TResponseWithQuotas[] = [];

        const getResponsesActionResponse = await getResponsesAction({
          surveyId,
          limit: responsesPerPage,
          offset: 0,
          filterCriteria: filters,
        });

        responses = getResponsesActionResponse?.data || [];

        if (responses.length < responsesPerPage) {
          setHasMore(false);
        } else {
          setHasMore(true);
        }
        setResponses(responses);
      } finally {
        setIsFetchingFirstPage(false);
      }
    };
    fetchFilteredResponses();
    // page is intentionally omitted to avoid refetching after the initial page setup.
    // hasFilters is derived from selectedFilter/dateRange which are already deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- effect must run only when the filter value changes, not on page updates it sets internally
  }, [filtersKey, responsesPerPage, selectedFilter, dateRange, surveyId]);

  return (
    <OutcomeQueryClientProvider>
      <div className="flex h-9 gap-1.5">
        <CustomFilter survey={surveyMemoized} />
      </div>
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
        outcomeActions={outcomeActions}
      />
    </OutcomeQueryClientProvider>
  );
};
