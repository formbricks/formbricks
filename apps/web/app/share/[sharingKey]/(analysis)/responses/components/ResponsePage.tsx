"use client";

import { useResponseFilter } from "@/app/(app)/environments/[environmentId]/components/ResponseFilterContext";
import { getFormattedFilters } from "@/app/lib/surveys/surveys";
import SurveyResultsTabs from "@/app/share/[sharingKey]/(analysis)/components/SurveyResultsTabs";
import ResponseTimeline from "@/app/share/[sharingKey]/(analysis)/responses/components/ResponseTimeline";
import {
  getResponseCountBySurveySharingKeyAction,
  getResponsesBySurveySharingKeyAction,
} from "@/app/share/[sharingKey]/action";
import CustomFilter from "@/app/share/[sharingKey]/components/CustomFilter";
import SummaryHeader from "@/app/share/[sharingKey]/components/SummaryHeader";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { checkForRecallInHeadline } from "@formbricks/lib/utils/recall";
import { TEnvironment } from "@formbricks/types/environment";
import { TProduct } from "@formbricks/types/product";
import { TResponse, TSurveyPersonAttributes } from "@formbricks/types/responses";
import { TSurvey } from "@formbricks/types/surveys";
import { TTag } from "@formbricks/types/tags";
import ContentWrapper from "@formbricks/ui/ContentWrapper";

interface ResponsePageProps {
  environment: TEnvironment;
  survey: TSurvey;
  surveyId: string;
  webAppUrl: string;
  product: TProduct;
  sharingKey: string;
  environmentTags: TTag[];
  attributes: TSurveyPersonAttributes;
  responsesPerPage: number;
}

const ResponsePage = ({
  environment,
  survey,
  surveyId,
  product,
  sharingKey,
  environmentTags,
  attributes,
  responsesPerPage,
}: ResponsePageProps) => {
  const [responses, setResponses] = useState<TResponse[]>([]);
  const [page, setPage] = useState<number>(1);
  const [hasMore, setHasMore] = useState<boolean>(true);
  const [responseCount, setResponseCount] = useState<number | null>(null);

  const { selectedFilter, dateRange, resetState } = useResponseFilter();

  const filters = useMemo(
    () => getFormattedFilters(survey, selectedFilter, dateRange),
    [survey, selectedFilter, dateRange]
  );

  const searchParams = useSearchParams();

  survey = useMemo(() => {
    return checkForRecallInHeadline(survey);
  }, [survey]);

  const fetchNextPage = useCallback(async () => {
    const newPage = page + 1;
    const newResponses = await getResponsesBySurveySharingKeyAction(
      sharingKey,
      newPage,
      responsesPerPage,
      filters
    );
    if (newResponses.length === 0 || newResponses.length < responsesPerPage) {
      setHasMore(false);
    }
    setResponses([...responses, ...newResponses]);
    setPage(newPage);
  }, [filters, page, responses, responsesPerPage, sharingKey]);

  useEffect(() => {
    if (!searchParams?.get("referer")) {
      resetState();
    }
  }, [searchParams, resetState]);

  useEffect(() => {
    const fetchInitialResponses = async () => {
      const responses = await getResponsesBySurveySharingKeyAction(sharingKey, 1, responsesPerPage, filters);
      if (responses.length < responsesPerPage) {
        setHasMore(false);
      }
      setResponses(responses);
    };
    fetchInitialResponses();
  }, [filters, responsesPerPage, sharingKey]);

  useEffect(() => {
    const handleResponsesCount = async () => {
      const responseCount = await getResponseCountBySurveySharingKeyAction(sharingKey, filters);
      setResponseCount(responseCount);
    };
    handleResponsesCount();
  }, [filters, sharingKey]);

  return (
    <ContentWrapper>
      <SummaryHeader survey={survey} product={product} />
      <CustomFilter environmentTags={environmentTags} attributes={attributes} survey={survey} />
      <SurveyResultsTabs
        activeId="responses"
        environmentId={environment.id}
        surveyId={surveyId}
        responseCount={responseCount}
        sharingKey={sharingKey}
      />
      <ResponseTimeline
        environment={environment}
        surveyId={surveyId}
        responses={responses}
        survey={survey}
        environmentTags={environmentTags}
        fetchNextPage={fetchNextPage}
        hasMore={hasMore}
      />
    </ContentWrapper>
  );
};

export default ResponsePage;
