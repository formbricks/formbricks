"use client";

import { useResponseFilter } from "@/app/(app)/environments/[environmentId]/components/ResponseFilterContext";
import { getSurveySummaryAction } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/actions";
import { useResponseCountContext } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/components/ResponseCountProvider";
import ScrollToTop from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/components/ScrollToTop";
import { SummaryDropOffs } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/components/SummaryDropOffs";
import { CustomFilter } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/components/CustomFilter";
import { ResultsShareButton } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/components/ResultsShareButton";
import { getFormattedFilters } from "@/app/lib/surveys/surveys";
import { getSummaryBySurveySharingKeyAction } from "@/app/share/[sharingKey]/actions";
import { replaceHeadlineRecall } from "@/lib/utils/recall";
import { useParams, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { TEnvironment } from "@formbricks/types/environment";
import { TSurvey, TSurveySummary } from "@formbricks/types/surveys/types";
import { TUserLocale } from "@formbricks/types/user";
import { SummaryList } from "./SummaryList";
import { SummaryMetadata } from "./SummaryMetadata";

const initialSurveySummary: TSurveySummary = {
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
}

export const SummaryPage = ({
  environment,
  survey,
  surveyId,
  webAppUrl,
  locale,
  isReadOnly,
}: SummaryPageProps) => {
  const params = useParams();
  const sharingKey = params.sharingKey as string;
  const isSharingPage = !!sharingKey;

  const searchParams = useSearchParams();

  const [surveySummary, setSurveySummary] = useState<TSurveySummary>(initialSurveySummary);
  const [showDropOffs, setShowDropOffs] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState(true);

  const { selectedFilter, dateRange, resetState } = useResponseFilter();

  // Use the shared response count context to avoid duplicate API calls
  const { responseCount } = useResponseCountContext();

  const filters = useMemo(
    () => getFormattedFilters(survey, selectedFilter, dateRange),
    [selectedFilter, dateRange, survey]
  );

  // Use a ref to keep the latest state and props
  const latestFiltersRef = useRef(filters);
  latestFiltersRef.current = filters;

  const getSummary = useCallback(() => {
    if (isSharingPage)
      return getSummaryBySurveySharingKeyAction({
        sharingKey,
        filterCriteria: latestFiltersRef.current,
      });

    return getSurveySummaryAction({
      surveyId,
      filterCriteria: latestFiltersRef.current,
    });
  }, [isSharingPage, sharingKey, surveyId]);

  const handleInitialData = useCallback(
    async (isInitialLoad = false) => {
      if (isInitialLoad) {
        setIsLoading(true);
      }

      try {
        const updatedSurveySummary = await getSummary();
        const surveySummary = updatedSurveySummary?.data ?? initialSurveySummary;
        setSurveySummary(surveySummary);
      } catch (error) {
        console.error(error);
      } finally {
        if (isInitialLoad) {
          setIsLoading(false);
        }
      }
    },
    [getSummary]
  );

  useEffect(() => {
    handleInitialData(true);
  }, [filters, isSharingPage, sharingKey, surveyId, handleInitialData]);

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
        responseCount={responseCount}
        survey={surveyMemoized}
        environment={environment}
        locale={locale}
      />
    </>
  );
};
