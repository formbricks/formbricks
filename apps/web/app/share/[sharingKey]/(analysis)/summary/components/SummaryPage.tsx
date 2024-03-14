"use client";

import { useResponseFilter } from "@/app/(app)/environments/[environmentId]/components/ResponseFilterContext";
import SummaryDropOffs from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/components/SummaryDropOffs";
import SummaryList from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/components/SummaryList";
import SummaryMetadata from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/components/SummaryMetadata";
import { getFormattedFilters } from "@/app/lib/surveys/surveys";
import SurveyResultsTabs from "@/app/share/[sharingKey]/(analysis)/components/SurveyResultsTabs";
import {
  getResponseCountBySurveySharingKeyAction,
  getSummaryBySurveySharingKeyAction,
} from "@/app/share/[sharingKey]/action";
import CustomFilter from "@/app/share/[sharingKey]/components/CustomFilter";
import SummaryHeader from "@/app/share/[sharingKey]/components/SummaryHeader";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { checkForRecallInHeadline } from "@formbricks/lib/utils/recall";
import { TEnvironment } from "@formbricks/types/environment";
import { TProduct } from "@formbricks/types/product";
import { TSurveyPersonAttributes, TSurveySummary } from "@formbricks/types/responses";
import { TSurvey } from "@formbricks/types/surveys";
import { TTag } from "@formbricks/types/tags";
import ContentWrapper from "@formbricks/ui/ContentWrapper";

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
  product: TProduct;
  sharingKey: string;
  environmentTags: TTag[];
  attributes: TSurveyPersonAttributes;
}

const SummaryPage = ({
  environment,
  survey,
  surveyId,
  product,
  sharingKey,
  environmentTags,
  attributes,
}: SummaryPageProps) => {
  const [responseCount, setResponseCount] = useState<number | null>(null);

  const { selectedFilter, dateRange, resetState } = useResponseFilter();
  const [surveySummary, setSurveySummary] = useState<TSurveySummary>(initialSurveySummary);
  const [showDropOffs, setShowDropOffs] = useState<boolean>(false);

  const filters = useMemo(
    () => getFormattedFilters(survey, selectedFilter, dateRange),
    [survey, selectedFilter, dateRange]
  );

  useEffect(() => {
    const handleInitialData = async () => {
      const responseCount = await getResponseCountBySurveySharingKeyAction(sharingKey, filters);
      setResponseCount(responseCount);
      if (responseCount === 0) {
        setSurveySummary(initialSurveySummary);
        return;
      }
      const response = await getSummaryBySurveySharingKeyAction(sharingKey, filters);
      setSurveySummary(response);
    };

    handleInitialData();
  }, [filters, sharingKey]);

  survey = useMemo(() => {
    return checkForRecallInHeadline(survey);
  }, [survey]);

  const searchParams = useSearchParams();

  useEffect(() => {
    if (!searchParams?.get("referer")) {
      resetState();
    }
  }, [searchParams, resetState]);

  return (
    <ContentWrapper>
      <SummaryHeader survey={survey} product={product} />
      <CustomFilter environmentTags={environmentTags} attributes={attributes} survey={survey} />
      <SurveyResultsTabs
        activeId="summary"
        environmentId={environment.id}
        surveyId={surveyId}
        responseCount={responseCount}
        sharingKey={sharingKey}
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
      />
    </ContentWrapper>
  );
};

export default SummaryPage;
