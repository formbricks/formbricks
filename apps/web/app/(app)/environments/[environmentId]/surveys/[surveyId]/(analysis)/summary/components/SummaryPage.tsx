"use client";

import CustomFilter from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/CustomFilter";
import SummaryHeader from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/SummaryHeader";
import SurveyResultsTabs from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/components/SurveyResultsTabs";
import SummaryList from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/components/SummaryList";
import SummaryMetadata from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/components/SummaryMetadata";
import ContentWrapper from "@/components/shared/ContentWrapper";
import { useResponseFilter } from "@/app/(app)/environments/[environmentId]/ResponseFilterContext";
import { getFilterResponses } from "@/lib/surveys/surveys";
import { TResponse } from "@formbricks/types/v1/responses";
import { TSurveyWithAnalytics } from "@formbricks/types/v1/surveys";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo } from "react";
import { TEnvironment } from "@formbricks/types/v1/environment";
import { TProduct } from "@formbricks/types/v1/product";
import { TTag } from "@formbricks/types/v1/tags";

interface SummaryPageProps {
  environment: TEnvironment;
  survey: TSurveyWithAnalytics;
  surveyId: string;
  responses: TResponse[];
  surveyBaseUrl: string;
  singleUseIds?: string[];
  product: TProduct;
  environmentTags: TTag[];
}

const SummaryPage = ({
  environment,
  survey,
  surveyId,
  responses,
  surveyBaseUrl,
  singleUseIds,
  product,
  environmentTags,
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
        environment={environment}
        survey={survey}
        surveyId={surveyId}
        surveyBaseUrl={surveyBaseUrl}
        singleUseIds={singleUseIds}
        product={product}
      />
      <CustomFilter
        environmentTags={environmentTags}
        responses={filterResponses}
        survey={survey}
        totalResponses={responses}
      />
      <SurveyResultsTabs activeId="summary" environmentId={environment.id} surveyId={surveyId} />
      <SummaryMetadata responses={filterResponses} survey={survey} />
      <SummaryList responses={filterResponses} survey={survey} environment={environment} />
    </ContentWrapper>
  );
};

export default SummaryPage;
