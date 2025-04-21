"use client";

import { useResponseFilter } from "@/app/(app)/environments/[environmentId]/components/ResponseFilterContext";
import {
  getResponseCountAction,
  getResponsesAction,
} from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/actions";
import { ResponseDataView } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/responses/components/ResponseDataView";
import { CustomFilter } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/components/CustomFilter";
import { ResultsShareButton } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/components/ResultsShareButton";
import { getFormattedFilters } from "@/app/lib/surveys/surveys";
import {
  getResponseCountBySurveySharingKeyAction,
  getResponsesBySurveySharingKeyAction,
} from "@/app/share/[sharingKey]/actions";
import { replaceHeadlineRecall } from "@/lib/utils/recall";
import { useParams, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { TEnvironment } from "@formbricks/types/environment";
import { TResponse } from "@formbricks/types/responses";
import { TSurvey } from "@formbricks/types/surveys/types";
import { TTag } from "@formbricks/types/tags";
import { TUser, TUserLocale } from "@formbricks/types/user";

interface ResponsePageProps {
  environment: TEnvironment;
  survey: TSurvey;
  surveyId: string;
  webAppUrl: string;
  user?: TUser;
  environmentTags: TTag[];
  responsesPerPage: number;
  locale: TUserLocale;
  isReadOnly: boolean;
}

export const ResponsePage = ({
  environment,
  survey,
  surveyId,
  webAppUrl,
  user,
  environmentTags,
  responsesPerPage,
  locale,
  isReadOnly,
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
      const getResponsesActionResponse = await getResponsesBySurveySharingKeyAction({
        sharingKey: sharingKey,
        limit: responsesPerPage,
        offset: (newPage - 1) * responsesPerPage,
        filterCriteria: filters,
      });
      newResponses = getResponsesActionResponse?.data || [];
    } else {
      const getResponsesActionResponse = await getResponsesAction({
        surveyId,
        limit: responsesPerPage,
        offset: (newPage - 1) * responsesPerPage,
        filterCriteria: filters,
      });
      newResponses = getResponsesActionResponse?.data || [];
    }

    if (newResponses.length === 0 || newResponses.length < responsesPerPage) {
      setHasMore(false);
    }
    setResponses([...responses, ...newResponses]);
    setPage(newPage);
  }, [filters, isSharingPage, page, responses, responsesPerPage, sharingKey, surveyId]);

  const deleteResponses = (responseIds: string[]) => {
    setResponses(responses.filter((response) => !responseIds.includes(response.id)));
    if (responseCount) {
      setResponseCount(responseCount - responseIds.length);
    }
  };

  const updateResponse = (responseId: string, updatedResponse: TResponse) => {
    if (responses) {
      setResponses(responses.map((response) => (response.id === responseId ? updatedResponse : response)));
    }
  };

  const surveyMemoized = useMemo(() => {
    return replaceHeadlineRecall(survey, "default");
  }, [survey]);

  useEffect(() => {
    if (!searchParams?.get("referer")) {
      resetState();
    }
  }, [searchParams, resetState]);

  useEffect(() => {
    const handleResponsesCount = async () => {
      let responseCount = 0;

      if (isSharingPage) {
        const responseCountActionResponse = await getResponseCountBySurveySharingKeyAction({
          sharingKey,
          filterCriteria: filters,
        });
        responseCount = responseCountActionResponse?.data || 0;
      } else {
        const responseCountActionResponse = await getResponseCountAction({
          surveyId,
          filterCriteria: filters,
        });
        responseCount = responseCountActionResponse?.data || 0;
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
          const getResponsesActionResponse = await getResponsesBySurveySharingKeyAction({
            sharingKey,
            limit: responsesPerPage,
            offset: 0,
            filterCriteria: filters,
          });

          responses = getResponsesActionResponse?.data || [];
        } else {
          const getResponsesActionResponse = await getResponsesAction({
            surveyId,
            limit: responsesPerPage,
            offset: 0,
            filterCriteria: filters,
          });

          responses = getResponsesActionResponse?.data || [];
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
        <CustomFilter survey={surveyMemoized} />
        {!isReadOnly && !isSharingPage && <ResultsShareButton survey={survey} webAppUrl={webAppUrl} />}
      </div>
      <ResponseDataView
        survey={survey}
        responses={responses}
        user={user}
        environment={environment}
        environmentTags={environmentTags}
        isReadOnly={isReadOnly}
        fetchNextPage={fetchNextPage}
        hasMore={hasMore}
        deleteResponses={deleteResponses}
        updateResponse={updateResponse}
        isFetchingFirstPage={isFetchingFirstPage}
        locale={locale}
      />
    </>
  );
};
