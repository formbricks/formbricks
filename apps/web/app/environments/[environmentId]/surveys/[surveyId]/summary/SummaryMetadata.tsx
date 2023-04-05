"use client";

import LoadingSpinner from "@/components/shared/LoadingSpinner";
import { useEnvironment } from "@/lib/environments/environments";
import { useResponses } from "@/lib/responses/responses";
import { useSurvey } from "@/lib/surveys/surveys";
import {
  Button,
  ErrorComponent,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@formbricks/ui";
import { PencilSquareIcon } from "@heroicons/react/24/solid";
import { useMemo } from "react";
import SurveyStatusDropdown from "@/components/shared/SurveyStatusDropdown";

export default function SummaryMetadata({ surveyId, environmentId }) {
  const { responses, isLoadingResponses, isErrorResponses } = useResponses(environmentId, surveyId);
  const { survey, isLoadingSurvey, isErrorSurvey } = useSurvey(environmentId, surveyId);
  const { environment, isLoadingEnvironment, isErrorEnvironment } = useEnvironment(environmentId);

  const completionRate = useMemo(() => {
    if (!responses) return 0;
    return (responses.filter((r) => r.finished).length / responses.length) * 100;
  }, [responses]);

  if (isLoadingResponses || isLoadingSurvey || isLoadingEnvironment) {
    return <LoadingSpinner />;
  }

  if (isErrorResponses || isErrorSurvey || isErrorEnvironment) {
    return <ErrorComponent />;
  }

  return (
    <div className="mb-4 grid grid-cols-7 gap-x-2">
      <div className=" space-y-2 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-sm text-slate-600">Survey displays</p>
        <p className="text-2xl font-bold text-slate-800">
          {survey.numDisplays === 0 ? <span>-</span> : survey.numDisplays}
        </p>
      </div>
      <div className="space-y-2 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-sm text-slate-600">Total Responses</p>
        <p className="text-2xl font-bold text-slate-800">
          {responses.length === 0 ? <span>-</span> : responses.length}
        </p>
      </div>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger>
            <div className="cursor-default space-y-2 rounded-lg border border-slate-200 bg-white p-4 text-left shadow-sm">
              <p className="text-sm text-slate-600">Response Rate</p>
              <p className="text-2xl font-bold text-slate-800">
                {survey.responseRate === null || survey.responseRate === 0 ? (
                  <span>-</span>
                ) : (
                  <span>{Math.round(survey.responseRate * 100)} %</span>
                )}
              </p>
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p>% of people who responded when survey was shown.</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger>
            <div className="space-y-2 rounded-lg border border-slate-200 bg-white p-4 text-left shadow-sm">
              <p className="text-sm text-slate-600">Completion Rate</p>
              <p className="text-2xl font-bold text-slate-800">
                {responses.length === 0 ? (
                  <span>-</span>
                ) : (
                  <span>{parseFloat(completionRate.toFixed(2))} %</span>
                )}
              </p>
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p>
              % of people who started <strong>and</strong> completed the survey.
            </p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <div className="col-span-3 flex flex-col justify-between">
        <div className=""></div>
        <div className="flex justify-end">
          {environment.widgetSetupCompleted && (
            <SurveyStatusDropdown surveyId={surveyId} environmentId={environmentId} />
          )}
          <Button className="ml-1.5 h-full" href={`/environments/${environmentId}/surveys/${surveyId}/edit`}>
            <PencilSquareIcon className="mr-2 h-5  w-5 text-white" /> Edit Survey
          </Button>
        </div>
      </div>
    </div>
  );
}
