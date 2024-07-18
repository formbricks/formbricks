"use client";

import { CheckIcon, ClockIcon, PauseIcon, PencilIcon } from "lucide-react";
import { TSurvey } from "@formbricks/types/surveys/types";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../Tooltip";

interface SurveyStatusIndicatorProps {
  status: TSurvey["status"];
  tooltip?: boolean;
}

export const SurveyStatusIndicator = ({ status, tooltip }: SurveyStatusIndicatorProps) => {
  if (tooltip) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger>
            {status === "inProgress" && (
              <span className="relative flex h-3 w-3">
                <span className="animate-ping-slow absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-75"></span>
                <span className="relative inline-flex h-3 w-3 rounded-full bg-green-500"></span>
              </span>
            )}
            {status === "scheduled" && (
              <div className="rounded-full bg-slate-300 p-1">
                <ClockIcon className="h-3 w-3 text-slate-600" />
              </div>
            )}
            {status === "paused" && (
              <div className="rounded-full bg-slate-300 p-1">
                <PauseIcon className="h-3 w-3 text-slate-600" />
              </div>
            )}
            {status === "completed" && (
              <div className="rounded-full bg-slate-200 p-1">
                <CheckIcon className="h-3 w-3 text-slate-600" />
              </div>
            )}
            {status === "draft" && (
              <div className="rounded-full bg-slate-200 p-1">
                <CheckIcon className="h-3 w-3 text-slate-600" />
              </div>
            )}
          </TooltipTrigger>
          <TooltipContent>
            <div className="flex items-center space-x-2">
              {status === "inProgress" ? (
                <>
                  <span>Gathering responses</span>
                  <span className="relative flex h-3 w-3">
                    <span className="animate-ping-slow absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-75"></span>
                    <span className="relative inline-flex h-3 w-3 rounded-full bg-green-500"></span>
                  </span>
                </>
              ) : status === "scheduled" ? (
                <>
                  <span className="text-slate-800">Survey scheduled.</span>
                  <div className="rounded-full bg-slate-300 p-1">
                    <ClockIcon className="h-3 w-3 text-slate-600" />
                  </div>
                </>
              ) : status === "paused" ? (
                <>
                  <span className="text-slate-800">Survey paused.</span>
                  <div className="rounded-full bg-slate-300 p-1">
                    <PauseIcon className="h-3 w-3 text-slate-600" />
                  </div>
                </>
              ) : status === "completed" ? (
                <div className="flex items-center space-x-2">
                  <span>Survey completed.</span>
                  <div className="rounded-full bg-slate-200 p-1">
                    <CheckIcon className="h-3 w-3 text-slate-600" />
                  </div>
                </div>
              ) : null}
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  } else
    return (
      <span>
        {status === "inProgress" && (
          <span className="relative flex h-3 w-3">
            <span className="animate-ping-slow absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-75"></span>
            <span className="relative inline-flex h-3 w-3 rounded-full bg-green-500"></span>
          </span>
        )}
        {status === "scheduled" && (
          <div className="rounded-full bg-slate-300 p-1">
            <ClockIcon className="h-3 w-3 text-slate-600" />
          </div>
        )}
        {status === "paused" && (
          <div className="rounded-full bg-slate-300 p-1">
            <PauseIcon className="h-3 w-3 text-slate-600" />
          </div>
        )}
        {status === "completed" && (
          <div className="rounded-full bg-slate-200 p-1">
            <CheckIcon className="h-3 w-3 text-slate-600" />
          </div>
        )}
        {status === "draft" && (
          <div className="rounded-full bg-slate-300 p-1">
            <PencilIcon className="h-3 w-3 text-slate-600" />
          </div>
        )}
      </span>
    );
};
