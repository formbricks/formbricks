"use client";

import { useResponseFilter } from "@/app/(app)/environments/[environmentId]/components/ResponseFilterContext";
import {
  getResponseCountAction,
  getResponsesAction,
} from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/actions";
import SurveyResultsTabs from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/components/SurveyResultsTabs";
import ResponseTimeline from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/responses/components/ResponseTimeline";
import CustomFilter from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/components/CustomFilter";
import SummaryHeader from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/components/SummaryHeader";
import { getFormattedFilters } from "@/app/lib/surveys/surveys";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { checkForRecallInHeadline } from "@formbricks/lib/utils/recall";
import { TEnvironment } from "@formbricks/types/environment";
import { TMembershipRole } from "@formbricks/types/memberships";
import { TProduct } from "@formbricks/types/product";
import { TResponse, TSurveyPersonAttributes } from "@formbricks/types/responses";
import { TSurvey } from "@formbricks/types/surveys";
import { TTag } from "@formbricks/types/tags";
import { TUser } from "@formbricks/types/user";
import ContentWrapper from "@formbricks/ui/ContentWrapper";

import ResultsShareButton from "../../../components/ResultsShareButton";

interface ResponsePageProps {
  environment: TEnvironment;
  survey: TSurvey;
  surveyId: string;
  webAppUrl: string;
  product: TProduct;
  user: TUser;
  environmentTags: TTag[];
  attributes: TSurveyPersonAttributes;
  responsesPerPage: number;
  membershipRole?: TMembershipRole;
}

const ResponsePage = ({
  environment,
  survey,
  surveyId,
  webAppUrl,
  product,
  user,
  environmentTags,
  attributes,
  responsesPerPage,
  membershipRole,
}: ResponsePageProps) => {
  const [responseCount, setResponseCount] = useState<number | null>(null);
  const [responses, setResponses] = useState<TResponse[]>([]);
  const [page, setPage] = useState<number>(1);
  const [hasMore, setHasMore] = useState<boolean>(true);

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
    const newResponses = await getResponsesAction(surveyId, newPage, responsesPerPage, filters);
    if (newResponses.length === 0 || newResponses.length < responsesPerPage) {
      setHasMore(false);
    }
    setResponses([...responses, ...newResponses]);
    setPage(newPage);
  }, [filters, page, responses, responsesPerPage, surveyId]);

  const deleteResponse = (responseId: string) => {
    setResponses(responses.filter((response) => response.id !== responseId));
  };

  const updateResponse = (responseId: string, updatedResponse: TResponse) => {
    setResponses(responses.map((response) => (response.id === responseId ? updatedResponse : response)));
  };

  useEffect(() => {
    if (!searchParams?.get("referer")) {
      resetState();
    }
  }, [searchParams, resetState]);

  useEffect(() => {
    const fetchInitialResponses = async () => {
      const responses = await getResponsesAction(surveyId, 1, responsesPerPage, filters);
      if (responses.length < responsesPerPage) {
        setHasMore(false);
      }
      setResponses(responses);
    };
    fetchInitialResponses();
  }, [surveyId, filters, responsesPerPage]);

  useEffect(() => {
    const handleResponsesCount = async () => {
      const responseCount = await getResponseCountAction(surveyId, filters);
      setResponseCount(responseCount);
    };
    handleResponsesCount();
  }, [filters, surveyId]);

  useEffect(() => {
    setPage(1);
    setHasMore(true);
    setResponses([]);
  }, [filters]);

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
      <SurveyResultsTabs
        activeId="responses"
        environmentId={environment.id}
        surveyId={surveyId}
        responseCount={responseCount}
      />
      <ResponseTimeline
        environment={environment}
        surveyId={surveyId}
        responses={responses}
        survey={survey}
        user={user}
        environmentTags={environmentTags}
        fetchNextPage={fetchNextPage}
        hasMore={hasMore}
        deleteResponse={deleteResponse}
        updateResponse={updateResponse}
      />
    </ContentWrapper>
  );
};

export default ResponsePage;
