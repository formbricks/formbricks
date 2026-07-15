"use client";

import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { TDisplayWithContact } from "@formbricks/types/displays";
import { TSurvey, TSurveySummary } from "@formbricks/types/surveys/types";
import { TUserLocale } from "@formbricks/types/user";
import {
  getDisplaysWithContactAction,
  getSurveySummaryAction,
} from "@/app/(app)/workspaces/[workspaceId]/surveys/[surveyId]/(analysis)/actions";
import { useResponseFilter } from "@/app/(app)/workspaces/[workspaceId]/surveys/[surveyId]/(analysis)/components/response-filter-context";
import ScrollToTop from "@/app/(app)/workspaces/[workspaceId]/surveys/[surveyId]/(analysis)/summary/components/ScrollToTop";
import { SummaryDropOffs } from "@/app/(app)/workspaces/[workspaceId]/surveys/[surveyId]/(analysis)/summary/components/SummaryDropOffs";
import { SummaryImpressions } from "@/app/(app)/workspaces/[workspaceId]/surveys/[surveyId]/(analysis)/summary/components/SummaryImpressions";
import { CustomFilter } from "@/app/(app)/workspaces/[workspaceId]/surveys/[surveyId]/components/CustomFilter";
import { getFormattedFilters } from "@/app/lib/surveys/surveys";
import { getFormattedErrorMessage } from "@/lib/utils/helper";
import { replaceHeadlineRecall } from "@/lib/utils/recall";
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
  const searchParams = useSearchParams();

  const [surveySummary, setSurveySummary] = useState<TSurveySummary>(
    initialSurveySummary || defaultSurveySummary
  );

  const [tab, setTab] = useState<"dropOffs" | "quotas" | "impressions" | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(!initialSurveySummary);

  const { selectedFilter, dateRange, resetState, registerAnalysisRefreshHandler } = useResponseFilter();

  const [displays, setDisplays] = useState<TDisplayWithContact[]>([]);
  const [isDisplaysLoading, setIsDisplaysLoading] = useState(false);
  const [hasMoreDisplays, setHasMoreDisplays] = useState(true);
  const [displaysError, setDisplaysError] = useState<string | null>(null);
  const displaysFetchedRef = useRef(false);

  const fetchDisplays = useCallback(
    async (offset: number) => {
      const response = await getDisplaysWithContactAction({
        surveyId,
        limit: DISPLAYS_PER_PAGE,
        offset,
      });

      if (!response?.data) {
        const errorMessage = getFormattedErrorMessage(response);
        throw new Error(errorMessage);
      }

      return response?.data ?? [];
    },
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
      toast.error(error instanceof Error ? error.message : String(error));
      setDisplays([]);
      setHasMoreDisplays(false);
    } finally {
      setIsDisplaysLoading(false);
    }
  }, [fetchDisplays]);

  const handleLoadMoreDisplays = useCallback(async () => {
    try {
      const data = await fetchDisplays(displays.length);
      setDisplays((prev) => [...prev, ...data]);
      setHasMoreDisplays(data.length === DISPLAYS_PER_PAGE);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : t("common.something_went_wrong");
      toast.error(errorMessage);
    }
  }, [fetchDisplays, displays.length, t]);

  useEffect(() => {
    if (tab === "impressions" && !displaysFetchedRef.current) {
      displaysFetchedRef.current = true;
      loadInitialDisplays();
    }
  }, [tab, loadInitialDisplays]);

  const fetchSummary = useCallback(async () => {
    const currentFilters = getFormattedFilters(survey, selectedFilter, dateRange);
    const updatedSurveySummary = await getSurveySummaryAction({
      surveyId,
      filterCriteria: currentFilters,
    });

    if (updatedSurveySummary?.serverError) {
      throw new Error(getFormattedErrorMessage(updatedSurveySummary));
    }

    setSurveySummary(updatedSurveySummary?.data ?? defaultSurveySummary);
  }, [dateRange, selectedFilter, survey, surveyId]);

  const refreshSummary = useCallback(async () => {
    setIsLoading(true);

    try {
      await Promise.all([fetchSummary(), tab === "impressions" ? loadInitialDisplays() : Promise.resolve()]);
    } finally {
      setIsLoading(false);
    }
  }, [fetchSummary, loadInitialDisplays, tab]);

  useEffect(() => {
    return registerAnalysisRefreshHandler(refreshSummary);
  }, [refreshSummary, registerAnalysisRefreshHandler]);

  // Dedupe fetches by the actual filter VALUES. Every authenticated server action re-sets the
  // Better Auth session cookie, and `cookies().set()` inside an action makes Next.js refresh the
  // route; that refresh hands this component fresh `survey`/`initialSurveySummary`/`fetchSummary`
  // references. Without this guard those new references re-fire the fetch effect → another action →
  // another refresh, i.e. an infinite loop.
  const lastFetchedFiltersKeyRef = useRef<string | null>(null);

  // Only fetch data when filters change or when there's no initial data
  useEffect(() => {
    // A default date range only sets `to` (today) with no `from`, which means "all time" and is
    // NOT an active filter. Treat filters as active only when the user has actually narrowed the data.
    const hasActiveFilters =
      (selectedFilter?.filter?.length ?? 0) > 0 ||
      (!!selectedFilter?.responseStatus && selectedFilter.responseStatus !== "all") ||
      Boolean(dateRange?.from);

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
    // Commit the key BEFORE awaiting so an action-triggered route refresh that re-runs this effect
    // finds it already set and skips — this is what breaks the loop.
    lastFetchedFiltersKeyRef.current = filtersKey;

    const fetchFilteredSummary = async () => {
      setIsLoading(true);

      try {
        await fetchSummary();
      } catch (error) {
        console.error(error);
        // Roll back the key on failure so re-selecting the same filter retries the fetch.
        lastFetchedFiltersKeyRef.current = null;
        // fetchSummary throws an Error whose message is already the formatted server error.
        toast.error(error instanceof Error ? error.message : t("common.something_went_wrong"));
      } finally {
        setIsLoading(false);
      }
    };

    fetchFilteredSummary();
  }, [selectedFilter, dateRange, initialSurveySummary, fetchSummary, survey, t]);

  const surveyMemoized = useMemo(() => {
    return replaceHeadlineRecall(survey, "default");
  }, [survey]);

  useEffect(() => {
    if (!searchParams?.get("referer")) {
      resetState();
    }
  }, [searchParams, resetState]);

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
      <div className="flex gap-1.5">
        <CustomFilter survey={surveyMemoized} />
      </div>
      <ScrollToTop containerId="mainContent" />
      <SummaryList
        summary={surveySummary.summary}
        responseCount={surveySummary.meta.totalResponses}
        survey={surveyMemoized}
        locale={locale}
        isReadOnly={isReadOnly}
      />
    </>
  );
};
