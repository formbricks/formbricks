"use client";

import { useResponseFilter } from "@/app/(app)/environments/[environmentId]/components/ResponseFilterContext";
import {
  getResponseCountAction,
  getResponsesAction,
} from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/actions";
import { ResponseCountView } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/responses/components/ResponseCountView";
import { ResponseDataView } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/responses/components/ResponseDataView";
import { CustomFilter } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/components/CustomFilter";
import { ResultsShareButton } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/components/ResultsShareButton";
import { getFormattedFilters } from "@/app/lib/surveys/surveys";
import { getResponsesBySurveySharingKeyAction } from "@/app/share/[sharingKey]/actions";
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
  publicDomain: string;
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
  publicDomain,
  user,
  environmentTags,
  responsesPerPage,
  locale,
  isReadOnly,
}: ResponsePageProps) => {
  const params = useParams();
  const sharingKey = params.sharingKey as string;
  const isSharingPage = !!sharingKey;

  const [responses, setResponses] = useState<TResponse[]>([]);
  const [page, setPage] = useState<number>(1);
  const [hasMore, setHasMore] = useState<boolean>(true);
  const [isFetchingFirstPage, setFetchingFirstPage] = useState<boolean>(true);
  const { selectedFilter, dateRange, resetState } = useResponseFilter();
  const [filteredCount, setFilteredCount] = useState<number>(0);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [toggleCountCache, setToggleCountCache] = useState<boolean>(false);
  const filters = useMemo(
    () => getFormattedFilters(survey, selectedFilter, dateRange),

    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedFilter, dateRange]
  );

  const searchParams = useSearchParams();

  useEffect(() => {
    const fetchTotalCount = async () => {
      const response = await getResponseCountAction({
        surveyId: survey.id,
        filterCriteria: {},
      });

      if (!response?.data) return;

      setTotalCount(response.data);
    };

    fetchTotalCount();
  }, [survey, toggleCountCache]);

  useEffect(() => {
    async function fetchFilteredCount() {
      const response = await getResponseCountAction({
        surveyId: survey.id,
        filterCriteria: filters,
      });

      if (!response?.data) return;

      setFilteredCount(response.data);

      // This covers a corner case if survey is "in-progress" && resetState
      // is called -- this will fetch the new filteredCount with updated response
      // but totalCount would still be cache since survey object hasn't changed.
      // In that case we toggle the "reactive" toggleCountCache and totalCount is refetched.
      if (response.data > totalCount) setToggleCountCache((value) => !value);
    }

    fetchFilteredCount();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [survey, selectedFilter, dateRange, totalCount]);

  const paginatedCount = useMemo(() => {
    if (filteredCount <= responsesPerPage) return filteredCount;

    const totalPages = Math.ceil(filteredCount / responsesPerPage);

    if (page < totalPages) return responsesPerPage * page;

    return filteredCount;
  }, [filteredCount, page, responsesPerPage]);

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
    setTotalCount((count) => count - 1);
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
    if (totalCount === 0) {
      setFetchingFirstPage(false);
      return;
    }

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
  }, [totalCount, surveyId, filters, responsesPerPage, sharingKey, isSharingPage]);

  useEffect(() => {
    setPage(1);
    setHasMore(true);
    setResponses([]);
  }, [filters]);

  return (
    <>
      <div className="flex gap-1.5">
        <CustomFilter survey={surveyMemoized} />
        {!isReadOnly && !isSharingPage && <ResultsShareButton survey={survey} publicDomain={publicDomain} />}
      </div>
      <ResponseCountView
        totalCount={totalCount}
        filteredCount={filteredCount}
        paginatedCount={paginatedCount}
      />
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
