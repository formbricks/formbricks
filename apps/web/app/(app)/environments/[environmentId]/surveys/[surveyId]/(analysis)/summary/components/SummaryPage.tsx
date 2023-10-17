"use client";

import { useResponseFilter } from "@/app/(app)/environments/[environmentId]/components/ResponseFilterContext";
import SurveyResultsTabs from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/components/SurveyResultsTabs";
import SummaryList from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/components/SummaryList";
import SummaryMetadata from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/components/SummaryMetadata";
import CustomFilter from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/components/CustomFilter";
import SummaryHeader from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/components/SummaryHeader";
import { getFilterResponses } from "@/app/lib/surveys/surveys";
import { TEnvironment } from "@formbricks/types/v1/environment";
import { TProduct } from "@formbricks/types/v1/product";
import { TProfile } from "@formbricks/types/v1/profile";
import { TResponse } from "@formbricks/types/v1/responses";
import { TSurvey } from "@formbricks/types/v1/surveys";
import { TTag } from "@formbricks/types/v1/tags";
import ContentWrapper from "@formbricks/ui/ContentWrapper";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo } from "react";

interface SummaryPageProps {
  environment: TEnvironment;
  survey: TSurvey;
  surveyId: string;
  responses: TResponse[];
  surveyBaseUrl: string;
  product: TProduct;
  profile: TProfile;
  environmentTags: TTag[];
  displayCount: number;
}

const SummaryPage = ({
  environment,
  survey,
  surveyId,
  responses,
  surveyBaseUrl,
  product,
  profile,
  environmentTags,
  displayCount,
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
        product={product}
        profile={profile}
      />
      <CustomFilter
        environmentTags={environmentTags}
        responses={filterResponses}
        survey={survey}
        totalResponses={responses}
      />
      <SurveyResultsTabs activeId="summary" environmentId={environment.id} surveyId={surveyId} />
      <SummaryMetadata responses={filterResponses} survey={survey} displayCount={displayCount} />
      <SummaryList responses={filterResponses} survey={survey} environment={environment} />
    </ContentWrapper>
  );
};

export default SummaryPage;
