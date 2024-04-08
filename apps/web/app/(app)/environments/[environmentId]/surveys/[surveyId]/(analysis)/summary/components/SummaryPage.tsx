"use client";

import { useResponseFilter } from "@/app/(app)/environments/[environmentId]/components/ResponseFilterContext";
import {
  getResponseCountAction,
  getSurveySummaryAction,
} from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/actions";
import SurveyResultsTabs from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/components/SurveyResultsTabs";
import SummaryDropOffs from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/components/SummaryDropOffs";
import SummaryList from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/components/SummaryList";
import SummaryMetadata from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/components/SummaryMetadata";
import CustomFilter from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/components/CustomFilter";
import SummaryHeader from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/components/SummaryHeader";
import { getFormattedFilters } from "@/app/lib/surveys/surveys";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { checkForRecallInHeadline } from "@formbricks/lib/utils/recall";
import { TEnvironment } from "@formbricks/types/environment";
import { TMembershipRole } from "@formbricks/types/memberships";
import { TProduct } from "@formbricks/types/product";
import { TSurveySummary } from "@formbricks/types/responses";
import { TSurvey } from "@formbricks/types/surveys";
import { TUser } from "@formbricks/types/user";
import ContentWrapper from "@formbricks/ui/ContentWrapper";

import ResultsShareButton from "../../../components/ResultsShareButton";

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
  product: TProduct;
  user: TUser;
  membershipRole?: TMembershipRole;
  totalResponseCount: number;
}

const SummaryPage = ({
  environment,
  survey,
  surveyId,
  webAppUrl,
  product,
  user,
  membershipRole,
  totalResponseCount,
}: SummaryPageProps) => {
  const [responseCount, setResponseCount] = useState<number | null>(null);
  const { selectedFilter, dateRange, resetState } = useResponseFilter();
  const [surveySummary, setSurveySummary] = useState<TSurveySummary>(initialSurveySummary);
  const [showDropOffs, setShowDropOffs] = useState<boolean>(false);
  const [isFetchingSummary, setFetchingSummary] = useState<boolean>(true);

  const filters = useMemo(
    () => getFormattedFilters(survey, selectedFilter, dateRange),
    [survey, selectedFilter, dateRange]
  );

  useEffect(() => {
    const handleInitialData = async () => {
      try {
        setFetchingSummary(true);
        const responseCount = await getResponseCountAction(surveyId, filters);
        setResponseCount(responseCount);
        if (responseCount === 0) {
          setSurveySummary(initialSurveySummary);
          return;
        }
        const response = await getSurveySummaryAction(surveyId, filters);
        setSurveySummary(response);
      } finally {
        setFetchingSummary(false);
      }
    };

    handleInitialData();
  }, [filters, surveyId]);

  const searchParams = useSearchParams();

  survey = useMemo(() => {
    return checkForRecallInHeadline(survey, "default");
  }, [survey]);

  useEffect(() => {
    if (!searchParams?.get("referer")) {
      resetState();
    }
  }, [searchParams, resetState]);

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
        <CustomFilter survey={survey} />
        <ResultsShareButton survey={survey} webAppUrl={webAppUrl} user={user} />
      </div>
      <SurveyResultsTabs
        activeId="summary"
        environmentId={environment.id}
        surveyId={surveyId}
        responseCount={responseCount}
      />
      <SummaryMetadata
        survey={survey}
        surveySummary={surveySummary.meta}
        showDropOffs={showDropOffs}
        setShowDropOffs={setShowDropOffs}
      />
      {showDropOffs && <SummaryDropOffs dropOff={surveySummary.dropOff} />}
      <SummaryList
        summary={surveySummary.summary}
        responseCount={responseCount}
        survey={survey}
        environment={environment}
        fetchingSummary={isFetchingSummary}
        totalResponseCount={totalResponseCount}
      />
    </ContentWrapper>
  );
};

export default SummaryPage;
