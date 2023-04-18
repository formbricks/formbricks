"use client";

import LoadingSpinner from "@/components/shared/LoadingSpinner";
import SurveyStatusDropdown from "@/components/shared/SurveyStatusDropdown";
import { useEnvironment } from "@/lib/environments/environments";
import { useResponses } from "@/lib/responses/responses";
import { useSurvey } from "@/lib/surveys/surveys";
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
import { PencilSquareIcon } from "@heroicons/react/24/solid";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import LinkSurveyModal from "./LinkSurveyModal";

export default function SummaryMetadata({ surveyId, environmentId }) {
  const { responsesData, isLoadingResponses, isErrorResponses } = useResponses(environmentId, surveyId);
  const { survey, isLoadingSurvey, isErrorSurvey } = useSurvey(environmentId, surveyId);
  const { environment, isLoadingEnvironment, isErrorEnvironment } = useEnvironment(environmentId);
  const [confetti, setConfetti] = useState(false);
  const [showLinkModal, setShowLinkModal] = useState(false);

  const searchParams = useSearchParams();

  useEffect(() => {
    if (searchParams && survey) {
      const newSurveyParam = searchParams.get("success");
      if (newSurveyParam === "true") {
        setConfetti(true);
        toast.success("Congrats! Your survey is live 🎉", {
          duration: 4000,
          position: "bottom-right",
        });
        if (survey.type === "link") {
          setShowLinkModal(true);
        }
      }
    }
  }, [searchParams, survey]);

  const responses = responsesData?.responses;

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
          {survey.type === "link" && (
            <Button
              variant="secondary"
              className="mr-1.5 h-full border border-slate-300 bg-white hover:bg-slate-100 focus:bg-slate-100"
              onClick={() => setShowLinkModal(true)}>
              <ShareIcon className="h-5 w-5" />
            </Button>
          )}
          {environment.widgetSetupCompleted && (
            <SurveyStatusDropdown surveyId={surveyId} environmentId={environmentId} />
          )}
          <Button className="ml-1.5 h-full" href={`/environments/${environmentId}/surveys/${surveyId}/edit`}>
            <PencilSquareIcon className="mr-2 h-5  w-5 text-white" /> Edit Survey
          </Button>
        </div>
      </div>
      {showLinkModal && <LinkSurveyModal survey={survey} open={showLinkModal} setOpen={setShowLinkModal} />}
      {confetti && <Confetti />}
    </div>
  );
}
