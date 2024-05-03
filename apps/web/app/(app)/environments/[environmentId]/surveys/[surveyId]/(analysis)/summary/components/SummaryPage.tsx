"use client";

import { useResponseFilter } from "@/app/(app)/environments/[environmentId]/components/ResponseFilterContext";
import {
  getResponseCountAction,
  getSurveySummaryAction,
} from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/actions";
import { SurveyResultsTabs } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/components/SurveyResultsTabs";
import { SummaryDropOffs } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/components/SummaryDropOffs";
import { CustomFilter } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/components/CustomFilter";
import { ResultsShareButton } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/components/ResultsShareButton";
import { SummaryHeader } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/components/SummaryHeader";
import { getFormattedFilters } from "@/app/lib/surveys/surveys";
import {
  getResponseCountBySurveySharingKeyAction,
  getSummaryBySurveySharingKeyAction,
} from "@/app/share/[sharingKey]/action";
import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { checkForRecallInHeadline } from "@formbricks/lib/utils/recall";
import { TEnvironment } from "@formbricks/types/environment";
import { TMembershipRole } from "@formbricks/types/memberships";
import { TProduct } from "@formbricks/types/product";
import { TSurvey, TSurveySummary } from "@formbricks/types/surveys";
import { TUser } from "@formbricks/types/user";
import { InnerContentWrapper } from "@formbricks/ui/InnerContentWrapper";

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
  product: TProduct;
  user?: TUser;
  membershipRole?: TMembershipRole;
  totalResponseCount: number;
}

const SummaryPage = ({
  environment,
  survey,
  surveyId,
  product,
  webAppUrl,
  user,
  membershipRole,
  totalResponseCount,
}: SummaryPageProps) => {
  const params = useParams();
  const sharingKey = params.sharingKey as string;
  const isSharingPage = !!sharingKey;

  const [responseCount, setResponseCount] = useState<number | null>(null);
  const [surveySummary, setSurveySummary] = useState<TSurveySummary>(initialSurveySummary);
  const [showDropOffs, setShowDropOffs] = useState<boolean>(false);
  const [isFetchingSummary, setFetchingSummary] = useState<boolean>(true);

  const { selectedFilter, dateRange, resetState } = useResponseFilter();

  const filters = useMemo(
    () => getFormattedFilters(survey, selectedFilter, dateRange),

    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedFilter, dateRange]
  );

  useEffect(() => {
    const handleInitialData = async () => {
      try {
        setFetchingSummary(true);
        let updatedResponseCount;
        if (isSharingPage) {
          updatedResponseCount = await getResponseCountBySurveySharingKeyAction(sharingKey, filters);
        } else {
          updatedResponseCount = await getResponseCountAction(surveyId, filters);
        }
        setResponseCount(updatedResponseCount);

        let updatedSurveySummary;
        if (isSharingPage) {
          updatedSurveySummary = await getSummaryBySurveySharingKeyAction(sharingKey, filters);
        } else {
          updatedSurveySummary = await getSurveySummaryAction(surveyId, filters);
        }

        setSurveySummary(updatedSurveySummary);
      } finally {
        setFetchingSummary(false);
      }
    };

    handleInitialData();
  }, [filters, isSharingPage, sharingKey, surveyId]);

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
    <InnerContentWrapper>
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
        {!isSharingPage && <ResultsShareButton survey={survey} webAppUrl={webAppUrl} user={user} />}
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
    </InnerContentWrapper>
  );
};

export default SummaryPage;
