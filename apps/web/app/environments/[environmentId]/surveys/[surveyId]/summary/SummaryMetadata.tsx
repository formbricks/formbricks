"use client";

import LoadingSpinner from "@/components/shared/LoadingSpinner";
import Button from "@/components/ui/Button";
import { useResponses } from "@/lib/responses/responses";
import { useMemo } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/Select";
import SurveyStatusIndicator from "@/components/shared/SurveyStatusIndicator";
import { useSurvey } from "@/lib/surveys/surveys";
import { PlayCircleIcon, PauseCircleIcon, StopCircleIcon, PencilSquareIcon } from "@heroicons/react/24/solid";
import { useSurveyMutation } from "@/lib/surveys/mutateSurveys";

export default function SummaryMetadata({ surveyId, environmentId }) {
  const { responses, isLoadingResponses, isErrorResponses } = useResponses(environmentId, surveyId);
  const { survey, isLoadingSurvey, isErrorSurvey } = useSurvey(environmentId, surveyId);
  const { triggerSurveyMutate } = useSurveyMutation(environmentId, surveyId);

  const responseRate = useMemo(() => {
    if (!responses) return 0;
    return (responses.filter((r) => r.finished).length / responses.length) * 100;
  }, [responses]);

  if (isLoadingResponses || isLoadingSurvey) {
    return <LoadingSpinner />;
  }

  if (isErrorResponses || isErrorSurvey) {
    return <p>Error loading Surveys</p>;
  }

  return (
    <div className="mb-4 grid grid-cols-3 gap-x-4">
      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm text-slate-600">Total Responses</p>
        <p className="text-2xl font-bold text-slate-800">
          {responses.length === 0 ? <span>-</span> : responses.length}
        </p>
      </div>
      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm text-slate-600">Response Rate</p>
        <p className="text-2xl font-bold text-slate-800">
          {responses.length === 0 ? <span>-</span> : <span>{parseFloat(responseRate.toFixed(2))} %</span>}
        </p>
      </div>
      <div className="flex flex-col justify-between">
        <div className=""></div>
        <div className="flex justify-end">
          {survey.status === "draft" || survey.status === "archived" ? (
            <div className="flex items-center">
              <SurveyStatusIndicator status={survey.status} />
              <span className="mr-3 italic text-slate-500">
                {survey.status === "draft" && "Survey drafted"}
                {survey.status === "archived" && "Survey archived"}
              </span>
            </div>
          ) : (
            <Select onValueChange={(value) => triggerSurveyMutate({ status: value })}>
              <SelectTrigger className="w-[180px] bg-white py-1.5">
                <SelectValue>
                  <div className="flex items-center">
                    <SurveyStatusIndicator status={survey.status} />
                    <span className="ml-2 text-slate-700">
                      {survey.status === "draft" && "Survey drafted"}
                      {survey.status === "inProgress" && "Collecting insights"}
                      {survey.status === "paused" && "Survey paused"}
                      {survey.status === "completed" && "Survey complete"}
                      {survey.status === "archived" && "Survey archived"}
                    </span>
                  </div>
                </SelectValue>
              </SelectTrigger>
              <SelectContent className="bg-white">
                <SelectItem className="group  font-normal hover:text-slate-900" value="inProgress">
                  <PlayCircleIcon className="mr-1 -mt-1 inline h-5 w-5 text-slate-500 group-hover:text-slate-800" />
                  Collect insights
                </SelectItem>
                <SelectItem className="group  font-normal hover:text-slate-900" value="paused">
                  <PauseCircleIcon className="mr-1 -mt-1 inline h-5 w-5 text-slate-500 group-hover:text-slate-800" />
                  Pause Survey
                </SelectItem>
                <SelectItem className="group  font-normal hover:text-slate-900" value="completed">
                  <StopCircleIcon className="mr-1 -mt-1 inline h-5 w-5 text-slate-500 group-hover:text-slate-800" />
                  End Survey
                </SelectItem>
              </SelectContent>
            </Select>
          )}
          <Button className="ml-1.5 h-full" href={`/environments/${environmentId}/surveys/${surveyId}/edit`}>
            <PencilSquareIcon className="mr-2 h-5  w-5 text-white" /> Edit Survey
          </Button>
        </div>
      </div>
    </div>
  );
}
