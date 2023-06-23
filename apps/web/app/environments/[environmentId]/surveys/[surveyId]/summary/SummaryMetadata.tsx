"use client";

import LoadingSpinner from "@/components/shared/LoadingSpinner";
import SurveyStatusDropdown from "@/components/shared/SurveyStatusDropdown";
import { useEnvironment } from "@/lib/environments/environments";
import { timeSinceConditionally } from "@formbricks/lib/time";
import { TResponse } from "@formbricks/types/v1/responses";
import { TSurvey } from "@formbricks/types/v1/surveys";
import {
  Button,
  Confetti,
  ErrorComponent,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@formbricks/ui";
import { ShareIcon } from "@heroicons/react/24/outline";
import { PencilSquareIcon, QuestionMarkCircleIcon } from "@heroicons/react/24/solid";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import LinkSurveyModal from "./LinkSurveyModal";

interface SummaryMetadataProps {
  surveyId: string;
  environmentId: string;
  responses: TResponse[];
  survey: TSurvey;
}

export default function SummaryMetadata({
  surveyId,
  environmentId,
  responses,
  survey,
}: SummaryMetadataProps) {
  const { environment, isLoadingEnvironment, isErrorEnvironment } = useEnvironment(environmentId);
  const [confetti, setConfetti] = useState(false);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const searchParams = useSearchParams();

  useEffect(() => {
    if (environment) {
      const newSurveyParam = searchParams?.get("success");
      if (newSurveyParam && survey && environment) {
        setConfetti(true);
        toast.success(
          survey.type === "web" && !environment.widgetSetupCompleted
            ? "Almost there! Install widget to start receiving responses."
            : "Congrats! Your survey is live.",
          {
            icon: survey.type === "web" && !environment.widgetSetupCompleted ? "🤏" : "🎉",
            duration: 5000,
            position: "bottom-right",
          }
        );
        if (survey.type === "link") {
          setShowLinkModal(true);
        }
      }
    }
  }, [environment, searchParams, survey]);

  const completionRate = useMemo(() => {
    if (!responses) return 0;
    return (responses.filter((r) => r.finished).length / responses.length) * 100;
  }, [responses]);

  if (isLoadingEnvironment) {
    return <LoadingSpinner />;
  }

  if (isErrorEnvironment) {
    return <ErrorComponent />;
  }

  return (
    <div className="mb-4 ">
      <div className="flex flex-col-reverse gap-y-2 lg:grid lg:grid-cols-2 lg:gap-x-2">
        <div className="grid grid-cols-2 gap-4 md:grid md:grid-cols-4 md:gap-x-2">
          <div className="flex flex-col justify-between space-y-2 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-sm text-slate-600">Survey displays</p>
            <p className="text-2xl font-bold text-slate-800">
              {survey.analytics.numDisplays === 0 ? <span>-</span> : survey.analytics.numDisplays}
            </p>
          </div>
          <div className="flex flex-col justify-between space-y-2 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-sm text-slate-600">Total Responses</p>
            <p className="text-2xl font-bold text-slate-800">
              {responses.length === 0 ? <span>-</span> : responses.length}
            </p>
          </div>
          <TooltipProvider delayDuration={50}>
            <Tooltip>
              <TooltipTrigger>
                <div className="flex h-full cursor-default flex-col justify-between space-y-2 rounded-lg border border-slate-200 bg-white p-4 text-left shadow-sm">
                  <p className="text-sm text-slate-600">
                    Response %
                    <QuestionMarkCircleIcon className="mb-1 ml-2 inline h-4 w-4 text-slate-500" />
                  </p>
                  <p className="text-2xl font-bold text-slate-800">
                    {survey.analytics.responseRate === null || survey.analytics.responseRate === 0 ? (
                      <span>-</span>
                    ) : (
                      <span>{Math.round(survey.analytics.responseRate * 100)} %</span>
                    )}
                  </p>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>% of people who responded when survey was shown.</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <TooltipProvider delayDuration={50}>
            <Tooltip>
              <TooltipTrigger>
                <div className="flex cursor-default flex-col justify-between space-y-2 rounded-lg border border-slate-200 bg-white p-4 text-left shadow-sm">
                  <p className="text-sm text-slate-600">
                    Completion %
                    <QuestionMarkCircleIcon className="mb-1 ml-2 inline h-4 w-4 text-slate-500" />
                  </p>
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
        </div>
        <div className="flex flex-col justify-between lg:col-span-1">
          <div className="text-right text-xs text-slate-400">
            Last updated: {timeSinceConditionally(survey.updatedAt.toISOString())}
          </div>
          <div className="flex justify-end gap-x-1.5">
            {survey.type === "link" && (
              <Button
                variant="secondary"
                className="h-full border border-slate-300 bg-white px-2 hover:bg-slate-100 focus:bg-slate-100 lg:px-6"
                onClick={() => setShowLinkModal(true)}>
                <ShareIcon className="h-5 w-5" />
              </Button>
            )}

            {environment.widgetSetupCompleted || survey.type === "link" ? (
              <SurveyStatusDropdown surveyId={surveyId} environmentId={environmentId} />
            ) : null}
            <Button
              variant="darkCTA"
              className="h-full w-full px-3 lg:px-6"
              href={`/environments/${environmentId}/surveys/${surveyId}/edit`}>
              <PencilSquareIcon className="mr-2 h-5  w-5 text-white" />
              Edit
            </Button>
          </div>
        </div>
      </div>
      {showLinkModal && <LinkSurveyModal survey={survey} open={showLinkModal} setOpen={setShowLinkModal} />}
      {confetti && <Confetti />}
    </div>
  );
}
