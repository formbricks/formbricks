"use client";

import { useResponseFilter } from "@/app/(app)/environments/[environmentId]/components/ResponseFilterContext";
import {
  getResponseCountAction,
  getResponsesAction,
} from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/actions";
import { ResponseTimeline } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/responses/components/ResponseTimeline";
import { CustomFilter } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/components/CustomFilter";
import { ResultsShareButton } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/components/ResultsShareButton";
import { getFormattedFilters } from "@/app/lib/surveys/surveys";
import {
  getResponseCountBySurveySharingKeyAction,
  getResponsesBySurveySharingKeyAction,
} from "@/app/share/[sharingKey]/actions";
import { useParams, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { TEnvironment } from "@formbricks/types/environment";
import { TResponse } from "@formbricks/types/responses";
import { TSurvey } from "@formbricks/types/surveys/types";
import { TTag } from "@formbricks/types/tags";
import { TUser } from "@formbricks/types/user";

interface ResponsePageProps {
  environment: TEnvironment;
  survey: TSurvey;
  surveyId: string;
  webAppUrl: string;
  user?: TUser;
  environmentTags: TTag[];
  responsesPerPage: number;
  totalResponseCount: number;
}

export const ResponsePage = ({
  environment,
  survey,
  surveyId,
  webAppUrl,
  user,
  environmentTags,
  responsesPerPage,
  totalResponseCount,
}: ResponsePageProps) => {
  const params = useParams();
  const sharingKey = params.sharingKey as string;
  const isSharingPage = !!sharingKey;

  const [responseCount, setResponseCount] = useState<number | null>(null);
  const [responses, setResponses] = useState<TResponse[]>([]);
  const [page, setPage] = useState<number>(1);
  const [hasMore, setHasMore] = useState<boolean>(true);
  const [isFetchingFirstPage, setFetchingFirstPage] = useState<boolean>(true);

  const { selectedFilter, dateRange, resetState } = useResponseFilter();

  const filters = useMemo(
    () => getFormattedFilters(survey, selectedFilter, dateRange),

    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedFilter, dateRange]
  );

  const searchParams = useSearchParams();

  const fetchNextPage = useCallback(async () => {
    const newPage = page + 1;

    let newResponses: TResponse[] = [];

    if (isSharingPage) {
      newResponses = await getResponsesBySurveySharingKeyAction(
        sharingKey,
        responsesPerPage,
        (newPage - 1) * responsesPerPage,
        filters
      );
    } else {
      newResponses = await getResponsesAction(
        surveyId,
        responsesPerPage,
        (newPage - 1) * responsesPerPage,
        filters
      );
    }

    if (newResponses.length === 0 || newResponses.length < responsesPerPage) {
      setHasMore(false);
    }
    setResponses([...responses, ...newResponses]);
    setPage(newPage);
  }, [filters, isSharingPage, page, responses, responsesPerPage, sharingKey, surveyId]);

  const deleteResponse = (responseId: string) => {
    setResponses(responses.filter((response) => response.id !== responseId));
    if (responseCount) {
      setResponseCount(responseCount - 1);
    }
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
    const handleResponsesCount = async () => {
      let responseCount = 0;

      if (isSharingPage) {
        responseCount = await getResponseCountBySurveySharingKeyAction(sharingKey, filters);
      } else {
        responseCount = await getResponseCountAction(surveyId, filters);
      }

      setResponseCount(responseCount);
    };
    handleResponsesCount();
  }, [filters, isSharingPage, sharingKey, surveyId]);

  useEffect(() => {
    const fetchInitialResponses = async () => {
      try {
        setFetchingFirstPage(true);

        let responses: TResponse[] = [];

        if (isSharingPage) {
          responses = await getResponsesBySurveySharingKeyAction(sharingKey, responsesPerPage, 0, filters);
        } else {
          responses = await getResponsesAction(surveyId, responsesPerPage, 0, filters);
        }

        if (responses.length < responsesPerPage) {
          setHasMore(false);
        }
        setResponses(responses);
      } finally {
        setFetchingFirstPage(false);
      }
    };
    fetchInitialResponses();
  }, [surveyId, filters, responsesPerPage, sharingKey, isSharingPage]);

  useEffect(() => {
    setPage(1);
    setHasMore(true);
    setResponses([]);
  }, [filters]);

  return (
    <>
      <div className="flex gap-1.5">
        <CustomFilter survey={survey} />
        {!isSharingPage && <ResultsShareButton survey={survey} webAppUrl={webAppUrl} />}
      </div>
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
        isFetchingFirstPage={isFetchingFirstPage}
        responseCount={responseCount}
        totalResponseCount={totalResponseCount}
        isSharingPage={isSharingPage}
      />
    </>
  );
};
