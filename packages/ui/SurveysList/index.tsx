"use client";

import { useState } from "react";

import { TEnvironment } from "@formbricks/types/environment";
import { TSurvey } from "@formbricks/types/surveys";

import { Button } from "../Button";
import ListItem from "./components/ListItem";
import SurveyCard from "./components/SurveyCard";
import SurveyFilters from "./components/SurveyFilters";

interface SurveysListProps {
  environment: TEnvironment;
  surveys: TSurvey[];
  otherEnvironment: TEnvironment;
  isViewer: boolean;
  WEBAPP_URL: string;
  userId: string;
}

export default function SurveysList({
  environment,
  surveys,
  otherEnvironment,
  isViewer,
  WEBAPP_URL,
  userId,
}: SurveysListProps) {
  const [filteredSurveys, setFilteredSurveys] = useState<TSurvey[]>(surveys);
  const [orientation, setOrientation] = useState("grid");
  return (
    <div className="space-y-4">
      <div className="flex justify-between">
        <h1 className="my-2 text-3xl font-bold text-slate-800">Surveys</h1>
        <Button
          href={`/environments/${environment.id}/surveys/templates`}
          variant="primary"
          className="text-md">
          New survey +
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
            <div className="flex flex-col space-y-4">
              <div className="mt-4 flex w-full px-4">
                <div className="w-[60%]">Name</div>
                <div className="flex w-[40%] justify-between">
                  <div>Created at</div>
                  <div>Updated at</div>
                  <div></div>
                </div>
              </div>
              {filteredSurveys.map((survey) => {
                return (
                  <ListItem
                    survey={survey}
                    environment={environment}
                    otherEnvironment={otherEnvironment}
                    isViewer={isViewer}
                    WEBAPP_URL={WEBAPP_URL}
                  />
                );
              })}
            </div>
          )}
          {orientation === "grid" && (
            <div className="grid grid-cols-4 place-content-stretch gap-6 lg:grid-cols-6 ">
              {filteredSurveys.map((survey) => {
                return (
                  <SurveyCard
                    survey={survey}
                    environment={environment}
                    otherEnvironment={otherEnvironment}
                    isViewer={isViewer}
                    WEBAPP_URL={WEBAPP_URL}
                  />
                );
              })}
            </div>
          )}
        </div>
      ) : (
        <div className="flex h-full flex-col items-center justify-center">
          <span className="mb-4 h-24 w-24 rounded-full bg-slate-300 p-6 text-5xl">🤔</span>

          <div className="text-xl">No surveys with matching filter found !</div>
        </div>
      )}
    </div>
  );
}
