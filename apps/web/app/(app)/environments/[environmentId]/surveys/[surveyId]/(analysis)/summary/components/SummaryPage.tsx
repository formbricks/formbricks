"use client";

import { useResponseFilter } from "@/app/(app)/environments/[environmentId]/components/ResponseFilterContext";
import { getSurveySummaryAction } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/actions";
import ScrollToTop from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/components/ScrollToTop";
import { SummaryDropOffs } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/components/SummaryDropOffs";
import { CustomFilter } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/components/CustomFilter";
import { ResultsShareButton } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/components/ResultsShareButton";
import { getFormattedFilters } from "@/app/lib/surveys/surveys";
import { getSummaryBySurveySharingKeyAction } from "@/app/share/[sharingKey]/actions";
import { replaceHeadlineRecall } from "@/lib/utils/recall";
import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { TEnvironment } from "@formbricks/types/environment";
import { TSurvey, TSurveySummary } from "@formbricks/types/surveys/types";
import { TUserLocale } from "@formbricks/types/user";
import { SummaryList } from "./SummaryList";
import { SummaryMetadata } from "./SummaryMetadata";

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
  },
  dropOff: [],
  summary: [],
};

interface SummaryPageProps {
  environment: TEnvironment;
  survey: TSurvey;
  surveyId: string;
  webAppUrl: string;
  locale: TUserLocale;
  isReadOnly: boolean;
  initialSurveySummary?: TSurveySummary;
}

export const SummaryPage = ({
  environment,
  survey,
  surveyId,
  webAppUrl,
  locale,
  isReadOnly,
  initialSurveySummary,
}: SummaryPageProps) => {
  const params = useParams();
  const sharingKey = params.sharingKey as string;
  const isSharingPage = !!sharingKey;

  const searchParams = useSearchParams();

  const [surveySummary, setSurveySummary] = useState<TSurveySummary>(
    initialSurveySummary || defaultSurveySummary
  );
  const [showDropOffs, setShowDropOffs] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState(!initialSurveySummary);

  const { selectedFilter, dateRange, resetState } = useResponseFilter();

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

        if (isSharingPage) {
          updatedSurveySummary = await getSummaryBySurveySharingKeyAction({
            sharingKey,
            filterCriteria: currentFilters,
          });
        } else {
          updatedSurveySummary = await getSurveySummaryAction({
            surveyId,
            filterCriteria: currentFilters,
          });
        }

        const surveySummary = updatedSurveySummary?.data ?? defaultSurveySummary;
        setSurveySummary(surveySummary);
      } catch (error) {
        console.error(error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSummary();
  }, [selectedFilter, dateRange, survey, isSharingPage, sharingKey, surveyId, initialSurveySummary]);

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
        showDropOffs={showDropOffs}
        setShowDropOffs={setShowDropOffs}
        isLoading={isLoading}
      />
      {showDropOffs && <SummaryDropOffs dropOff={surveySummary.dropOff} survey={surveyMemoized} />}
      <div className="flex gap-1.5">
        <CustomFilter survey={surveyMemoized} />
        {!isReadOnly && !isSharingPage && (
          <ResultsShareButton survey={surveyMemoized} webAppUrl={webAppUrl} />
        )}
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
