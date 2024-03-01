"use client";

import { useResponseFilter } from "@/app/(app)/environments/[environmentId]/components/ResponseFilterContext";
import { getSurveySummaryAction } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/actions";
import SurveyResultsTabs from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/components/SurveyResultsTabs";
import SummaryDropOffs from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/components/SummaryDropOffs";
import SummaryList from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/components/SummaryList";
import SummaryMetadata from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/components/SummaryMetadata";
import CustomFilter from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/components/CustomFilter";
import SummaryHeader from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/components/SummaryHeader";
import { getFilterResponses, getFormattedFilters } from "@/app/lib/surveys/surveys";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { checkForRecallInHeadline } from "@formbricks/lib/utils/recall";
import { TEnvironment } from "@formbricks/types/environment";
import { TMembershipRole } from "@formbricks/types/memberships";
import { TProduct } from "@formbricks/types/product";
import { TResponse, TSurveyPersonAttributes, TSurveySummary } from "@formbricks/types/responses";
import { TSurvey } from "@formbricks/types/surveys";
import { TTag } from "@formbricks/types/tags";
import { TUser } from "@formbricks/types/user";
import ContentWrapper from "@formbricks/ui/ContentWrapper";

import ResultsShareButton from "../../../components/ResultsShareButton";

interface SummaryPageProps {
  environment: TEnvironment;
  survey: TSurvey;
  surveyId: string;
  responses: TResponse[];
  webAppUrl: string;
  product: TProduct;
  user: TUser;
  environmentTags: TTag[];
  attributes: TSurveyPersonAttributes;
  responsesPerPage: number;
  membershipRole?: TMembershipRole;
}

const SummaryPage = ({
  environment,
  survey,
  surveyId,
  responses,
  webAppUrl,
  product,
  user,
  environmentTags,
  attributes,
  responsesPerPage,
  membershipRole,
}: SummaryPageProps) => {
  const { selectedFilter, dateRange, resetState } = useResponseFilter();
  const [surveySummary, setSurveySummary] = useState<TSurveySummary>({
    meta: {
      completedPercentage: 0,
      completedResponses: 0,
      displayCount: 0,
      dropoffRate: 0,
      dropoffs: 0,
      startsPercentage: 0,
      totalResponses: 0,
      ttcAverage: 0,
    },
    dropoff: [],
    summary: [],
  });
  const [showDropOffs, setShowDropOffs] = useState<boolean>(false);

  const filters = useMemo(
    () => getFormattedFilters(survey, selectedFilter, dateRange),
    [survey, selectedFilter, dateRange]
  );

  useEffect(() => {
    const fetchSurveySummary = async () => {
      const response = await getSurveySummaryAction(surveyId, filters);
      console.log({ response });
      setSurveySummary(response);
    };
    fetchSurveySummary();
  }, [filters, surveyId]);

  const searchParams = useSearchParams();
  survey = useMemo(() => {
    return checkForRecallInHeadline(survey);
  }, [survey]);
  useEffect(() => {
    if (!searchParams?.get("referer")) {
      resetState();
    }
  }, [searchParams, resetState]);

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
        webAppUrl={webAppUrl}
        product={product}
        user={user}
        membershipRole={membershipRole}
      />
      <div className="flex gap-1.5">
        <CustomFilter environmentTags={environmentTags} attributes={attributes} survey={survey} />
        <ResultsShareButton survey={survey} webAppUrl={webAppUrl} product={product} user={user} />
      </div>
      <SurveyResultsTabs activeId="summary" environmentId={environment.id} surveyId={surveyId} />
      <SummaryMetadata
        responses={filterResponses}
        survey={survey}
        surveySummary={surveySummary.meta}
        showDropOffs={showDropOffs}
        setShowDropOffs={setShowDropOffs}
      />
      {showDropOffs && <SummaryDropOffs dropoff={surveySummary?.dropoff} />}
      <SummaryList
        summary={surveySummary.summary}
        responses={filterResponses}
        survey={survey}
        environment={environment}
        responsesPerPage={responsesPerPage}
      />
    </ContentWrapper>
  );
};

export default SummaryPage;
