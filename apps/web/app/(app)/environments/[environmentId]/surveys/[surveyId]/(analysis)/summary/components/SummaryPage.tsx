"use client";

import { useResponseFilter } from "@/app/(app)/environments/[environmentId]/components/ResponseFilterContext";
import {
  getResponseCountAction,
  getSurveySummaryAction,
} from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/actions";
import { SummaryDropOffs } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/components/SummaryDropOffs";
import { CustomFilter } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/components/CustomFilter";
import { ResultsShareButton } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/components/ResultsShareButton";
import { getFormattedFilters } from "@/app/lib/surveys/surveys";
import {
  getResponseCountBySurveySharingKeyAction,
  getSummaryBySurveySharingKeyAction,
} from "@/app/share/[sharingKey]/actions";
import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { replaceHeadlineRecall } from "@formbricks/lib/utils/recall";
import { TAttributeClass } from "@formbricks/types/attribute-classes";
import { TEnvironment } from "@formbricks/types/environment";
import { TSurvey, TSurveySummary } from "@formbricks/types/surveys/types";
import { TUser } from "@formbricks/types/user";
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
  user?: TUser;
  totalResponseCount: number;
  attributeClasses: TAttributeClass[];
}

export const SummaryPage = ({
  environment,
  survey,
  surveyId,
  webAppUrl,
  user,
  totalResponseCount,
  attributeClasses,
}: SummaryPageProps) => {
  const params = useParams();
  const sharingKey = params.sharingKey as string;
  const isSharingPage = !!sharingKey;

  const [responseCount, setResponseCount] = useState<number | null>(null);
  const [surveySummary, setSurveySummary] = useState<TSurveySummary>(initialSurveySummary);
  const [showDropOffs, setShowDropOffs] = useState<boolean>(false);

  const { selectedFilter, dateRange, resetState } = useResponseFilter();

  const filters = useMemo(
    () => getFormattedFilters(survey, selectedFilter, dateRange),

    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedFilter, dateRange]
  );

  useEffect(() => {
    const handleInitialData = async () => {
      try {
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
      } catch (error) {
        console.error(error);
      }
    };

    handleInitialData();
  }, [filters, isSharingPage, sharingKey, surveyId]);

  const searchParams = useSearchParams();

  const surveyMemoized = useMemo(() => {
    return replaceHeadlineRecall(survey, "default", attributeClasses);
  }, [survey, attributeClasses]);

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
      />
      {showDropOffs && <SummaryDropOffs dropOff={surveySummary.dropOff} />}
      <div className="flex gap-1.5">
        <CustomFilter survey={surveyMemoized} />
        {!isSharingPage && <ResultsShareButton survey={surveyMemoized} webAppUrl={webAppUrl} user={user} />}
      </div>
      <SummaryList
        summary={surveySummary.summary}
        responseCount={responseCount}
        survey={surveyMemoized}
        environment={environment}
        totalResponseCount={totalResponseCount}
        attributeClasses={attributeClasses}
      />
    </>
  );
};
