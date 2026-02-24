"use client";

import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { TDisplayWithContact } from "@formbricks/types/displays";
import { TEnvironment } from "@formbricks/types/environment";
import { TSurvey, TSurveySummary } from "@formbricks/types/surveys/types";
import { TUserLocale } from "@formbricks/types/user";
import {
  getDisplaysWithContactAction,
  getSurveySummaryAction,
} from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/actions";
import { useResponseFilter } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/components/response-filter-context";
import ScrollToTop from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/components/ScrollToTop";
import { SummaryDropOffs } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/components/SummaryDropOffs";
import { SummaryImpressions } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/components/SummaryImpressions";
import { CustomFilter } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/components/CustomFilter";
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
  environment: TEnvironment;
  survey: TSurvey;
  surveyId: string;
  locale: TUserLocale;
  initialSurveySummary?: TSurveySummary;
  isQuotasAllowed: boolean;
}

export const SummaryPage = ({
  environment,
  survey,
  surveyId,
  locale,
  initialSurveySummary,
  isQuotasAllowed,
}: SummaryPageProps) => {
  const { t } = useTranslation();
  const searchParams = useSearchParams();

  const [surveySummary, setSurveySummary] = useState<TSurveySummary>(
    initialSurveySummary || defaultSurveySummary
  );

  const [tab, setTab] = useState<"dropOffs" | "quotas" | "impressions" | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(!initialSurveySummary);

  const { selectedFilter, dateRange, resetState } = useResponseFilter();

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
      toast.error(error);
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

  // Only fetch data when filters change or when there's no initial data
  useEffect(() => {
    // If we have initial data and no filters are applied, don't fetch
    const hasNoFilters =
      (!selectedFilter ||
        Object.keys(selectedFilter).length === 0 ||
        (selectedFilter.filter && selectedFilter.filter.length === 0)) &&
      (!dateRange || (!dateRange.from && !dateRange.to));

    if (initialSurveySummary && hasNoFilters) {
      setIsLoading(false);
      return;
    }

    const fetchSummary = async () => {
      setIsLoading(true);

      try {
        // Recalculate filters inside the effect to ensure we have the latest values
        const currentFilters = getFormattedFilters(survey, selectedFilter, dateRange);
        let updatedSurveySummary;

        updatedSurveySummary = await getSurveySummaryAction({
          surveyId,
          filterCriteria: currentFilters,
        });

        const surveySummary = updatedSurveySummary?.data ?? defaultSurveySummary;
        setSurveySummary(surveySummary);
      } catch (error) {
        console.error(error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSummary();
  }, [selectedFilter, dateRange, survey, surveyId, initialSurveySummary]);

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
          environmentId={environment.id}
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
        environment={environment}
        locale={locale}
      />
    </>
  );
};
