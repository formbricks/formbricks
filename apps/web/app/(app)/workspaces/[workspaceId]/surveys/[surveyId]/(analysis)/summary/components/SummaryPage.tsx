"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { TDisplayWithContact } from "@formbricks/types/displays";
import { TSurvey, TSurveySummary } from "@formbricks/types/surveys/types";
import { TUserLocale } from "@formbricks/types/user";
import { ResponseToolbar } from "@/app/(app)/workspaces/[workspaceId]/surveys/[surveyId]/(analysis)/components/ResponseToolbar";
import { useResponseFilter } from "@/app/(app)/workspaces/[workspaceId]/surveys/[surveyId]/(analysis)/components/response-filter-context";
import { useResponseTableFilters } from "@/app/(app)/workspaces/[workspaceId]/surveys/[surveyId]/(analysis)/hooks/use-response-table-filters";
import ScrollToTop from "@/app/(app)/workspaces/[workspaceId]/surveys/[surveyId]/(analysis)/summary/components/ScrollToTop";
import { SummaryDropOffs } from "@/app/(app)/workspaces/[workspaceId]/surveys/[surveyId]/(analysis)/summary/components/SummaryDropOffs";
import { SummaryImpressions } from "@/app/(app)/workspaces/[workspaceId]/surveys/[surveyId]/(analysis)/summary/components/SummaryImpressions";
import {
  listSurveyDisplays,
  querySurveySummary,
} from "@/app/(app)/workspaces/[workspaceId]/surveys/[surveyId]/(analysis)/summary/lib/api-client";
import { getFormattedFilters } from "@/app/lib/surveys/surveys";
import { replaceHeadlineRecall } from "@/lib/utils/recall";
import { getV3ApiErrorMessage } from "@/modules/api/lib/v3-client";
import { QuotasSummary } from "@/modules/ee/quotas/components/quotas-summary";
import { SummaryList } from "./SummaryList";
import { SummaryMetadata } from "./SummaryMetadata";

const DISPLAYS_PER_PAGE = 15;

const defaultSurveySummary: TSurveySummary = {
  meta: {
    completedPercentage: 0,
    completedResponses: 0,
    displayCount: 0,
    dropOffPercentage: 0,
    dropOffCount: 0,
    startsPercentage: 0,
    totalResponses: 0,
    ttcAverage: 0,
    quotasCompleted: 0,
    quotasCompletedPercentage: 0,
  },
  dropOff: [],
  quotas: [],
  summary: [],
};

interface SummaryPageProps {
  survey: TSurvey;
  surveyId: string;
  locale: TUserLocale;
  initialSurveySummary?: TSurveySummary;
  isQuotasAllowed: boolean;
  isReadOnly: boolean;
}

export const SummaryPage = ({
  survey,
  surveyId,
  locale,
  initialSurveySummary,
  isQuotasAllowed,
  isReadOnly,
}: Readonly<SummaryPageProps>) => {
  const { t } = useTranslation();

  const [surveySummary, setSurveySummary] = useState<TSurveySummary>(
    initialSurveySummary || defaultSurveySummary
  );

  const [tab, setTab] = useState<"dropOffs" | "quotas" | "impressions" | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(!initialSurveySummary);

  const { registerAnalysisRefreshHandler } = useResponseFilter();
  const filterState = useResponseTableFilters(survey);
  const { selectedFilter, dateRange } = filterState;

  const [displays, setDisplays] = useState<TDisplayWithContact[]>([]);
  const [isDisplaysLoading, setIsDisplaysLoading] = useState(false);
  const [hasMoreDisplays, setHasMoreDisplays] = useState(true);
  const [displaysError, setDisplaysError] = useState<string | null>(null);
  const displaysFetchedRef = useRef(false);

  const fetchDisplays = useCallback(
    (offset: number) => listSurveyDisplays({ surveyId, limit: DISPLAYS_PER_PAGE, offset }),
    [surveyId]
  );

  const loadInitialDisplays = useCallback(async () => {
    setIsDisplaysLoading(true);
    setDisplaysError(null);
    try {
      const data = await fetchDisplays(0);
      setDisplays(data);
      setHasMoreDisplays(data.length === DISPLAYS_PER_PAGE);
    } catch (error) {
      setDisplaysError(getV3ApiErrorMessage(error, t("common.something_went_wrong")));
      setDisplays([]);
      setHasMoreDisplays(false);
    } finally {
      setIsDisplaysLoading(false);
    }
  }, [fetchDisplays, t]);

  const handleLoadMoreDisplays = useCallback(async () => {
    try {
      const data = await fetchDisplays(displays.length);
      setDisplays((prev) => [...prev, ...data]);
      setHasMoreDisplays(data.length === DISPLAYS_PER_PAGE);
    } catch (error) {
      toast.error(getV3ApiErrorMessage(error, t("common.something_went_wrong")));
    }
  }, [fetchDisplays, displays.length, t]);

  useEffect(() => {
    if (tab === "impressions" && !displaysFetchedRef.current) {
      displaysFetchedRef.current = true;
      loadInitialDisplays();
    }
  }, [tab, loadInitialDisplays]);

  const fetchSummary = useCallback(async () => {
    // Asked about now: a refresh after midnight must not reuse yesterday's relative date window.
    const currentFilters = filterState.resolveFreshCriteria();
    setSurveySummary(await querySurveySummary({ surveyId, filterCriteria: currentFilters }));
  }, [filterState.resolveFreshCriteria, surveyId]);

  const refreshSummary = useCallback(async () => {
    if (!filterState.isReady) return;
    setIsLoading(true);

    try {
      await Promise.all([fetchSummary(), tab === "impressions" ? loadInitialDisplays() : Promise.resolve()]);
    } finally {
      setIsLoading(false);
    }
  }, [fetchSummary, filterState.isReady, loadInitialDisplays, tab]);

  useEffect(() => {
    return registerAnalysisRefreshHandler(refreshSummary);
  }, [refreshSummary, registerAnalysisRefreshHandler]);

  // Dedupe fetches by the actual filter VALUES. A route refresh (the survey status dropdown, the share
  // modal, a reset) hands this component fresh `survey`/`initialSurveySummary`/`fetchSummary`
  // references; without this guard they would re-fire the fetch effect for unchanged filters. (The
  // server action this page used to call refreshed the route itself, which made that an infinite loop.)
  const lastFetchedFiltersKeyRef = useRef<string | null>(null);

  // Only fetch data when filters change or when there's no initial data
  useEffect(() => {
    // A default date range only sets `to` (today) with no `from`, which means "all time" and is
    // NOT an active filter. Treat filters as active only when the user has actually narrowed the data.
    const hasActiveFilters =
      (selectedFilter?.filter?.length ?? 0) > 0 ||
      (selectedFilter?.responseStatuses?.length ?? 0) > 0 ||
      Boolean(dateRange?.from);

    // A rule in the URL still waiting for the filter data: the summary would answer for every response.
    if (!filterState.isReady) {
      lastFetchedFiltersKeyRef.current = null;
      setIsLoading(true);
      return;
    }

    // If we have server-provided initial data and no active filters, use it instead of refetching.
    // (Also covers clearing filters: fall back to the unfiltered initial summary without a fetch.)
    if (initialSurveySummary && !hasActiveFilters) {
      lastFetchedFiltersKeyRef.current = null;
      setSurveySummary(initialSurveySummary);
      setIsLoading(false);
      return;
    }

    // Skip when only prop references changed (a route refresh) but the filter values are identical
    // to the last fetch. getFormattedFilters is deterministic for fixed inputs.
    const filtersKey = JSON.stringify(getFormattedFilters(survey, selectedFilter, dateRange));
    if (filtersKey === lastFetchedFiltersKeyRef.current) {
      return;
    }
    // Commit the key BEFORE awaiting so a route refresh that re-runs this effect mid-fetch finds it
    // already set and skips.
    lastFetchedFiltersKeyRef.current = filtersKey;

    const fetchFilteredSummary = async () => {
      setIsLoading(true);

      try {
        await fetchSummary();
      } catch (error) {
        console.error(error);
        // Roll back the key on failure so re-selecting the same filter retries the fetch.
        lastFetchedFiltersKeyRef.current = null;
        toast.error(getV3ApiErrorMessage(error, t("common.something_went_wrong")));
      } finally {
        setIsLoading(false);
      }
    };

    fetchFilteredSummary();
  }, [selectedFilter, dateRange, initialSurveySummary, fetchSummary, filterState.isReady, survey, t]);

  const surveyMemoized = useMemo(() => {
    return replaceHeadlineRecall(survey, "default");
  }, [survey]);

  return (
    <>
      <SummaryMetadata
        surveySummary={surveySummary.meta}
        quotasCount={surveySummary.quotas?.length ?? 0}
        isLoading={isLoading}
        tab={tab}
        setTab={setTab}
        isQuotasAllowed={isQuotasAllowed}
      />
      {tab === "impressions" && (
        <SummaryImpressions
          displays={displays}
          isLoading={isDisplaysLoading}
          hasMore={hasMoreDisplays}
          displaysError={displaysError}
          locale={locale}
          onLoadMore={handleLoadMoreDisplays}
          onRetry={loadInitialDisplays}
        />
      )}
      {tab === "dropOffs" && <SummaryDropOffs dropOff={surveySummary.dropOff} survey={surveyMemoized} />}
      {isQuotasAllowed && tab === "quotas" && <QuotasSummary quotas={surveySummary.quotas} />}
      <ResponseToolbar
        survey={surveyMemoized}
        filterState={filterState}
        matchCount={isLoading ? null : surveySummary.meta.totalResponses}
      />
      <ScrollToTop containerId="mainContent" />
      <SummaryList
        summary={surveySummary.summary}
        dropOff={surveySummary.dropOff}
        responseCount={surveySummary.meta.totalResponses}
        survey={surveyMemoized}
        locale={locale}
        isReadOnly={isReadOnly}
      />
    </>
  );
};
