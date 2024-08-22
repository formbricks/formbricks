"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { TEnvironment } from "@formbricks/types/environment";
import { TProductConfigChannel } from "@formbricks/types/product";
import { TSurvey, TSurveyFilters } from "@formbricks/types/surveys/types";
import { Button } from "../Button";
import { getSurveysAction } from "./actions";
import { SurveyCard } from "./components/SurveyCard";
import { SurveyFilters } from "./components/SurveyFilters";
import { getFormattedFilters } from "./utils";

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
  sortBy: "updatedAt",
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

  const filters = useMemo(() => getFormattedFilters(surveyFilters, userId), [surveyFilters, userId]);

  const [orientation, setOrientation] = useState("");

  useEffect(() => {
    // Initialize orientation state with a function that checks if window is defined
    const orientationFromLocalStorage = localStorage.getItem("surveyOrientation");
    if (orientationFromLocalStorage) {
      setOrientation(orientationFromLocalStorage);
    } else {
      setOrientation("grid");
      localStorage.setItem("surveyOrientation", "list");
    }
  }, []);

  useEffect(() => {
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
        orientation={orientation}
        setOrientation={setOrientation}
        surveyFilters={surveyFilters}
        setSurveyFilters={setSurveyFilters}
        currentProductChannel={currentProductChannel}
      />
      {surveys.length > 0 ? (
        <div>
          {orientation === "list" && (
            <div className="flex-col space-y-3">
              <div className="mt-6 grid w-full grid-cols-8 place-items-center gap-3 px-6 text-sm text-slate-800">
                <div className="col-span-4 place-self-start">Name</div>
                <div className="col-span-4 grid w-full grid-cols-5 place-items-center">
                  <div className="col-span-2">Created at</div>
                  <div className="col-span-2">Updated at</div>
                </div>
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
                    orientation={orientation}
                    duplicateSurvey={handleDuplicateSurvey}
                    deleteSurvey={handleDeleteSurvey}
                  />
                );
              })}
            </div>
          )}
          {orientation === "grid" && (
            <div className="grid grid-cols-2 place-content-stretch gap-4 lg:grid-cols-3 2xl:grid-cols-5">
              {surveys.map((survey) => {
                return (
                  <SurveyCard
                    key={survey.id}
                    survey={survey}
                    environment={environment}
                    otherEnvironment={otherEnvironment}
                    isViewer={isViewer}
                    WEBAPP_URL={WEBAPP_URL}
                    orientation={orientation}
                    duplicateSurvey={handleDuplicateSurvey}
                    deleteSurvey={handleDeleteSurvey}
                  />
                );
              })}
            </div>
          )}

          {hasMore && (
            <div className="flex justify-center py-5">
              <Button onClick={fetchNextPage} variant="secondary" size="sm" loading={isFetching}>
                Load more
              </Button>
            </div>
          )}
        </div>
      ) : (
        <div className="flex h-full flex-col items-center justify-center">
          <span className="mb-4 h-24 w-24 rounded-full bg-slate-100 p-6 text-5xl">🕵️</span>

          <div className="text-slate-600">{isFetching ? "Fetching surveys..." : "No surveys found"}</div>
        </div>
      )}
    </div>
  );
};
