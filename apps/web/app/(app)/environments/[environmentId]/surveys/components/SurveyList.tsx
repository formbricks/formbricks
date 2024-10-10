"use client";

import { getSurveysAction } from "@/app/(app)/environments/[environmentId]/surveys/actions";
import { getFormattedFilters } from "@/app/(app)/environments/[environmentId]/surveys/lib/utils";
import { TSurvey } from "@/app/(app)/environments/[environmentId]/surveys/types/surveys";
import { useCallback, useEffect, useMemo, useState } from "react";
import { FORMBRICKS_SURVEYS_FILTERS_KEY_LS } from "@formbricks/lib/localStorage";
import { TEnvironment } from "@formbricks/types/environment";
import { wrapThrows } from "@formbricks/types/error-handlers";
import { TProductConfigChannel } from "@formbricks/types/product";
import { TSurveyFilters } from "@formbricks/types/surveys/types";
import { Button } from "@formbricks/ui/components/Button";
import { SurveyCard } from "./SurveyCard";
import { SurveyFilters } from "./SurveyFilters";
import { SurveyLoading } from "./SurveyLoading";

interface SurveysListProps {
  environment: TEnvironment;
  otherEnvironment: TEnvironment;
  isViewer: boolean;
  WEBAPP_URL: string;
  userId: string;
  surveysPerPage: number;
  currentProductChannel: TProductConfigChannel;
}

export const initialFilters: TSurveyFilters = {
  name: "",
  createdBy: [],
  status: [],
  type: [],
  sortBy: "relevance",
};

export const SurveysList = ({
  environment,
  otherEnvironment,
  isViewer,
  WEBAPP_URL,
  userId,
  surveysPerPage: surveysLimit,
  currentProductChannel,
}: SurveysListProps) => {
  const [surveys, setSurveys] = useState<TSurvey[]>([]);
  const [isFetching, setIsFetching] = useState(true);
  const [hasMore, setHasMore] = useState<boolean>(true);

  const [surveyFilters, setSurveyFilters] = useState<TSurveyFilters>(initialFilters);
  const [isFilterInitialized, setIsFilterInitialized] = useState(false);

  const filters = useMemo(() => getFormattedFilters(surveyFilters, userId), [surveyFilters, userId]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedFilters = localStorage.getItem(FORMBRICKS_SURVEYS_FILTERS_KEY_LS);
      if (savedFilters) {
        const surveyParseResult = wrapThrows(() => JSON.parse(savedFilters))();

        if (!surveyParseResult.ok) {
          localStorage.removeItem(FORMBRICKS_SURVEYS_FILTERS_KEY_LS);
          setSurveyFilters(initialFilters);
        } else {
          setSurveyFilters(surveyParseResult.data);
        }
      }
      setIsFilterInitialized(true);
    }
  }, []);

  useEffect(() => {
    if (isFilterInitialized) {
      localStorage.setItem(FORMBRICKS_SURVEYS_FILTERS_KEY_LS, JSON.stringify(surveyFilters));
    }
  }, [surveyFilters, isFilterInitialized]);

  useEffect(() => {
    if (isFilterInitialized) {
      const fetchInitialSurveys = async () => {
        setIsFetching(true);
        const res = await getSurveysAction({
          environmentId: environment.id,
          limit: surveysLimit,
          offset: undefined,
          filterCriteria: filters,
        });
        if (res?.data) {
          if (res.data.length < surveysLimit) {
            setHasMore(false);
          } else {
            setHasMore(true);
          }
          setSurveys(res.data);
          setIsFetching(false);
        }
      };
      fetchInitialSurveys();
    }
  }, [environment.id, surveysLimit, filters]);

  const fetchNextPage = useCallback(async () => {
    setIsFetching(true);
    const res = await getSurveysAction({
      environmentId: environment.id,
      limit: surveysLimit,
      offset: surveys.length,
      filterCriteria: filters,
    });
    if (res?.data) {
      if (res.data.length === 0 || res.data.length < surveysLimit) {
        setHasMore(false);
      } else {
        setHasMore(true);
      }

      setSurveys([...surveys, ...res.data]);
      setIsFetching(false);
    }
  }, [environment.id, surveys, surveysLimit, filters]);

  const handleDeleteSurvey = async (surveyId: string) => {
    const newSurveys = surveys.filter((survey) => survey.id !== surveyId);
    setSurveys(newSurveys);
  };

  const handleDuplicateSurvey = async (survey: TSurvey) => {
    const newSurveys = [survey, ...surveys];
    setSurveys(newSurveys);
  };

  return (
    <div className="space-y-6">
      <SurveyFilters
        surveyFilters={surveyFilters}
        setSurveyFilters={setSurveyFilters}
        currentProductChannel={currentProductChannel}
      />
      {surveys.length > 0 ? (
        <div>
          <div className="flex-col space-y-3">
            <div className="mt-6 grid w-full grid-cols-8 place-items-center gap-3 px-6 text-sm text-slate-800">
              <div className="col-span-1 place-self-start">Name</div>
              <div className="col-span-1">Status</div>
              <div className="col-span-1">Responses</div>
              <div className="col-span-1">Type</div>
              <div className="col-span-1">Created at</div>
              <div className="col-span-1">Updated at</div>
              <div className="col-span-1">Created by</div>
            </div>
            {surveys.map((survey) => {
              return (
                <SurveyCard
                  key={survey.id}
                  survey={survey}
                  environment={environment}
                  otherEnvironment={otherEnvironment}
                  isViewer={isViewer}
                  WEBAPP_URL={WEBAPP_URL}
                  duplicateSurvey={handleDuplicateSurvey}
                  deleteSurvey={handleDeleteSurvey}
                />
              );
            })}
          </div>

          {hasMore && (
            <div className="flex justify-center py-5">
              <Button onClick={fetchNextPage} variant="secondary" size="sm" loading={isFetching}>
                Load more
              </Button>
            </div>
          )}
        </div>
      ) : (
        <div className="flex h-full w-full">
          {isFetching ? (
            <SurveyLoading />
          ) : (
            <div className="flex w-full flex-col items-center justify-center text-slate-600">
              <span className="h-24 w-24 p-4 text-center text-5xl">🕵️</span>
              No surveys found
            </div>
          )}
        </div>
      )}
    </div>
  );
};
