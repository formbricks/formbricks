"use client";
import CustomFilter from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/components/CustomFilter";
import SummaryHeader from "@/app/(app)/share/[sharingKey]/components/SummaryHeader";
import SurveyResultsTabs from "@/app/(app)/share/[sharingKey]/(analysis)/components/SurveyResultsTabs";
import ResponseTimeline from "@/app/(app)/share/[sharingKey]/(analysis)/responses/components/ResponseTimeline";
import ContentWrapper from "@formbricks/ui/ContentWrapper";
import { useResponseFilter } from "@/app/(app)/environments/[environmentId]/components/ResponseFilterContext";
import { getFilterResponses } from "@/app/lib/surveys/surveys";
import { TResponse } from "@formbricks/types/responses";
import { TSurvey } from "@formbricks/types/surveys";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo } from "react";
import { TEnvironment } from "@formbricks/types/environment";
import { TProduct } from "@formbricks/types/product";
import { TTag } from "@formbricks/types/tags";

interface ResponsePageProps {
  environment: TEnvironment;
  survey: TSurvey;
  surveyId: string;
  responses: TResponse[];
  webAppUrl: string;
  product: TProduct;
  sharingKey: string;
  environmentTags: TTag[];
  responsesPerPage: number;
}

const ResponsePage = ({
  environment,
  survey,
  surveyId,
  responses,
  webAppUrl,
  product,
  sharingKey,
  environmentTags,
  responsesPerPage,
}: ResponsePageProps) => {
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
      <SummaryHeader survey={survey} surveyId={surveyId} product={product} />
      <CustomFilter
        environmentTags={environmentTags}
        responses={filterResponses}
        survey={survey}
        totalResponses={responses}
      />
      <SurveyResultsTabs
        activeId="responses"
        environmentId={environment.id}
        surveyId={surveyId}
        sharingKey={sharingKey}
      />
      <ResponseTimeline
        environment={environment}
        surveyId={surveyId}
        responses={filterResponses}
        survey={survey}
        environmentTags={environmentTags}
        responsesPerPage={responsesPerPage}
      />
    </ContentWrapper>
  );
};

export default ResponsePage;
