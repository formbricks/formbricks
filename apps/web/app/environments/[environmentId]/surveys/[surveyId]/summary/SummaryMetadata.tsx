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

  /*   useEffect(() => {
    if (environment) {
      console.log(environment.widgetSetupCompleted);
      const newSurveyParam = searchParams?.get("success");
      if (newSurveyParam === "true" && survey) {
        console.log(survey);
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
  }, [environment, searchParams, survey]); */

  const [toastMessage, setToastMessage] = useState("");

  useEffect(() => {
    if (environment) {
      const newSurveyParam = searchParams?.get("success");
      if (newSurveyParam === "true" && survey) {
        setConfetti(true);

        const newToastMessage =
          survey.type === "web" && !environment.widgetSetupCompleted
            ? "Almost there! Install widget to start receiving responses."
            : "Congrats! Your survey is live.";

        if (newToastMessage !== toastMessage) {
          setToastMessage(newToastMessage);
        }
      }
    }
  }, [environment, searchParams, survey]);

  useEffect(() => {
    if (toastMessage) {
      toast.success(toastMessage, {
        icon: survey.type === "web" && !environment.widgetSetupCompleted ? "🤏" : "🎉",
        duration: 5000,
        position: "bottom-right",
      });

      if (survey.type === "link") {
        setShowLinkModal(true);
      }
    }
  }, [toastMessage]);

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
    <div className="mb-4 ">
      <div className="flex flex-col-reverse gap-y-2 lg:grid lg:grid-cols-2 lg:gap-x-2">
        <div className="grid grid-cols-2 gap-4 md:grid md:grid-cols-4 md:gap-x-2">
          <div className="flex flex-col justify-between space-y-2 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-sm text-slate-600">Survey displays</p>
            <p className="text-2xl font-bold text-slate-800">
              {survey.numDisplays === 0 ? <span>-</span> : survey.numDisplays}
            </p>
          </div>
          <div className="flex flex-col justify-between space-y-2 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-sm text-slate-600">Total Responses</p>
            <p className="text-2xl font-bold text-slate-800">
              {responses.length === 0 ? <span>-</span> : responses.length}
            </p>
          </div>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <div className="flex h-full cursor-default flex-col justify-between space-y-2 rounded-lg border border-slate-200 bg-white p-4 text-left shadow-sm">
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
                <div className="flex flex-col justify-between space-y-2 rounded-lg border border-slate-200 bg-white p-4 text-left shadow-sm">
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
        </div>
        <div className="flex flex-col justify-between lg:col-span-1">
          <div className=""></div>
          <div className="flex justify-end gap-x-1.5">
            {survey.type === "link" && (
              <Button
                variant="secondary"
                className="h-full border border-slate-300 bg-white px-2 hover:bg-slate-100 focus:bg-slate-100 lg:px-6"
                onClick={() => setShowLinkModal(true)}>
                <ShareIcon className="h-5 w-5" />
              </Button>
            )}

            {environment.widgetSetupCompleted && (
              <SurveyStatusDropdown surveyId={surveyId} environmentId={environmentId} />
            )}
            <Button
              className="h-full w-full px-3 lg:px-6"
              href={`/environments/${environmentId}/surveys/${surveyId}/edit`}>
              <PencilSquareIcon className="mr-2 h-5  w-5 text-white" />
              Edit Survey
            </Button>
          </div>
        </div>
      </div>
      {showLinkModal && <LinkSurveyModal survey={survey} open={showLinkModal} setOpen={setShowLinkModal} />}
      {confetti && <Confetti />}
    </div>
  );
}
