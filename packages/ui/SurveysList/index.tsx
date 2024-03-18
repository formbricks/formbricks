"use client";

import { PlusIcon } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { TEnvironment } from "@formbricks/types/environment";
import { TSurvey } from "@formbricks/types/surveys";

import { Button } from "../v2/Button";
import { getSurveysAction } from "./actions";
import SurveyCard from "./components/SurveyCard";
import SurveyFilters from "./components/SurveyFilters";

interface SurveysListProps {
  environment: TEnvironment;
  otherEnvironment: TEnvironment;
  isViewer: boolean;
  WEBAPP_URL: string;
  userId: string;
  surveysPerPage: number;
}

export default function SurveysList({
  environment,
  otherEnvironment,
  isViewer,
  WEBAPP_URL,
  userId,
  surveysPerPage: surveysLimit,
}: SurveysListProps) {
  const [surveys, setSurveys] = useState<TSurvey[]>([]);
  const [isFetching, setIsFetching] = useState(true);
  const [hasMore, setHasMore] = useState<boolean>(true);

  const [filteredSurveys, setFilteredSurveys] = useState<TSurvey[]>(surveys);

  // Initialize orientation state with a function that checks if window is defined
  const [orientation, setOrientation] = useState(() =>
    typeof localStorage !== "undefined" ? localStorage.getItem("surveyOrientation") || "grid" : "grid"
  );

  // Save orientation to localStorage
  useEffect(() => {
    localStorage.setItem("surveyOrientation", orientation);
  }, [orientation]);

  useEffect(() => {
    async function fetchInitialSurveys() {
      setIsFetching(true);
      const res = await getSurveysAction(environment.id, surveysLimit);
      if (res.length < surveysLimit) setHasMore(false);
      setSurveys(res);
      setIsFetching(false);
    }
    fetchInitialSurveys();
  }, [environment.id, surveysLimit]);

  const fetchNextPage = useCallback(async () => {
    setIsFetching(true);
    const newSurveys = await getSurveysAction(environment.id, surveysLimit, surveys.length);
    if (newSurveys.length === 0 || newSurveys.length < surveysLimit) {
      setHasMore(false);
    }
    setSurveys([...surveys, ...newSurveys]);
    setIsFetching(false);
  }, [environment.id, surveys, surveysLimit]);

  const handleDeleteSurvey = async (surveyId: string) => {
    const newSurveys = surveys.filter((survey) => survey.id !== surveyId);
    setSurveys(newSurveys);
  };

  const handleDuplicateSurvey = async (survey: TSurvey) => {
    const newSurveys = [survey, ...surveys];
    setSurveys(newSurveys);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between">
        <h1 className="my-2 text-3xl font-bold text-slate-800">Surveys</h1>
        <Button
          href={`/environments/${environment.id}/surveys/templates`}
          variant="darkCTA"
          EndIcon={PlusIcon}>
          New survey
        </Button>
      </div>
      <SurveyFilters
        surveys={surveys}
        setFilteredSurveys={setFilteredSurveys}
        orientation={orientation}
        setOrientation={setOrientation}
        userId={userId}
      />
      {filteredSurveys.length > 0 ? (
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
              {filteredSurveys.map((survey) => {
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
            <div className="grid grid-cols-4 place-content-stretch gap-4 lg:grid-cols-6 ">
              {filteredSurveys.map((survey) => {
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

          <div className="text-slate-600">{isFetching ? "Fetching Surveys" : "No surveys found"}</div>
        </div>
      )}
    </div>
  );
}
