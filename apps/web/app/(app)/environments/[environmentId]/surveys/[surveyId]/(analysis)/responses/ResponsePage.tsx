"use client";
import CustomFilter from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/CustomFilter";
import SummaryHeader from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/SummaryHeader";
import SurveyResultsTabs from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/SurveyResultsTabs";
import ResponseTimeline from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/responses/ResponseTimeline";
import ContentWrapper from "@/components/shared/ContentWrapper";
import { useResponseFilter } from "@/app/(app)/environments/[environmentId]/ResponseFilterContext";
import { getFilterResponses } from "@/lib/surveys/surveys";
import { TResponse } from "@formbricks/types/v1/responses";
import { TSurvey } from "@formbricks/types/v1/surveys";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo } from "react";

interface ResponsePageProps {
  environmentId: string;
  survey: TSurvey;
  surveyId: string;
  responses: TResponse[];
  surveyBaseUrl: string;
}

const ResponsePage = ({ environmentId, survey, surveyId, responses, surveyBaseUrl }: ResponsePageProps) => {
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
      />
      <CustomFilter
        environmentId={environmentId}
        responses={filterResponses}
        survey={survey}
        totalResponses={responses}
      />
      <SurveyResultsTabs activeId="responses" environmentId={environmentId} surveyId={surveyId} />
      <ResponseTimeline
        environmentId={environmentId}
        surveyId={surveyId}
        responses={filterResponses}
        survey={survey}
      />
    </ContentWrapper>
  );
};

export default ResponsePage;
