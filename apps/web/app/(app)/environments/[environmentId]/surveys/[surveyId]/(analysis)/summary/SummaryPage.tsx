"use client";

import CustomFilter from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/CustomFilter";
import SummaryHeader from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/SummaryHeader";
import SurveyResultsTabs from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/SurveyResultsTabs";
import SummaryList from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/SummaryList";
import SummaryMetadata from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/SummaryMetadata";
import ContentWrapper from "@/components/shared/ContentWrapper";
import { useResponseFilter } from "@/app/(app)/environments/[environmentId]/ResponseFilterContext";
import { getFilterResponses } from "@/lib/surveys/surveys";
import { TResponse } from "@formbricks/types/v1/responses";
import { TSurveyWithAnalytics } from "@formbricks/types/v1/surveys";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo } from "react";

interface SummaryPageProps {
  environmentId: string;
  survey: TSurveyWithAnalytics;
  surveyId: string;
  responses: TResponse[];
  surveyBaseUrl: string;
  singleUseIds?: string[];
}

const SummaryPage = ({
  environmentId,
  survey,
  surveyId,
  responses,
  surveyBaseUrl,
  singleUseIds,
}: SummaryPageProps) => {
  const { selectedFilter, dateRange, resetState } = useResponseFilter();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!searchParams?.get("referer")) {
      resetState();
    }
  }, [searchParams]);
  // get the filtered array when the selected filter value changes
  const filterResponses: TResponse[] = useMemo(() => {
    return getFilterResponses(responses, selectedFilter, survey, dateRange);
  }, [selectedFilter, responses, survey, dateRange]);

  return (
    <ContentWrapper>
      <SummaryHeader
        environmentId={environmentId}
        survey={survey}
        surveyId={surveyId}
        surveyBaseUrl={surveyBaseUrl}
        singleUseIds={singleUseIds}
      />
      <CustomFilter
        environmentId={environmentId}
        responses={filterResponses}
        survey={survey}
        totalResponses={responses}
      />
      <SurveyResultsTabs activeId="summary" environmentId={environmentId} surveyId={surveyId} />
      <SummaryMetadata responses={filterResponses} survey={survey} />
      <SummaryList responses={filterResponses} survey={survey} environmentId={environmentId} />
    </ContentWrapper>
  );
};

export default SummaryPage;
