import { timeSinceConditionally } from "@formbricks/lib/time";
import { TResponse } from "@formbricks/types/v1/responses";
import { TSurveyWithAnalytics } from "@formbricks/types/v1/surveys";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@formbricks/ui";

interface SummaryMetadataProps {
  responses: TResponse[];
  survey: TSurveyWithAnalytics;
}

export default function SummaryMetadata({ responses, survey }: SummaryMetadataProps) {
  const completedResponsesLength = responses.filter((r) => r.finished).length;

  return (
    <>
      <div className="mb-4 ">
        <div className="flex flex-col-reverse gap-y-2 lg:grid lg:grid-cols-2 lg:gap-x-2">
          <div className="grid grid-cols-2 gap-4 md:grid md:grid-cols-4 md:gap-x-2">
            <div className="flex flex-col justify-between space-y-2 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-sm text-slate-600">displays</p>
              <p className="text-2xl font-bold text-slate-800">
                {survey.analytics.numDisplays === 0 ? <span>-</span> : survey.analytics.numDisplays}
              </p>
            </div>
            <TooltipProvider delayDuration={50}>
              <Tooltip>
                <TooltipTrigger>
                  <div className="flex h-full cursor-default flex-col justify-between space-y-2 rounded-lg border border-slate-200 bg-white p-4 text-left shadow-sm">
                    <p className="text-sm text-slate-600">
                      Starts
                      <span className="ml-1 rounded-xl bg-slate-100 px-2 py-1 text-xs">
                        {Math.round((responses.length / survey.analytics.numDisplays) * 100)}%
                      </span>
                    </p>
                    <p className="text-2xl font-bold text-slate-800">
                      {responses.length === 0 ? <span>-</span> : responses.length}
                    </p>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>People who started the survey.</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <TooltipProvider delayDuration={50}>
              <Tooltip>
                <TooltipTrigger>
                  <div className="flex h-full cursor-default flex-col justify-between space-y-2 rounded-lg border border-slate-200 bg-white p-4 text-left shadow-sm">
                    <p className="text-sm text-slate-600">
                      Responses
                      <span className="ml-1 rounded-xl bg-slate-100 px-2 py-1 text-xs">
                        {Math.round((completedResponsesLength / survey.analytics.numDisplays) * 100)}%
                      </span>
                    </p>
                    <p className="text-2xl font-bold text-slate-800">
                      <span>{completedResponsesLength}</span>
                    </p>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>People who completed the survey.</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <TooltipProvider delayDuration={50}>
              <Tooltip>
                <TooltipTrigger>
                  <div className="flex cursor-default flex-col justify-between space-y-2 rounded-lg border border-slate-200 bg-white p-4 text-left shadow-sm">
                    <p className="text-sm text-slate-600">
                      Drop Offs
                      <span className="ml-1 rounded-xl bg-slate-100 px-2 py-1 text-xs">
                        {Math.round(
                          ((survey.analytics.numDisplays - survey.analytics.numResponses) /
                            survey.analytics.numDisplays) *
                            100
                        )}
                        %
                      </span>
                    </p>
                    <p className="text-2xl font-bold text-slate-800">
                      {responses.length === 0 ? (
                        <span>-</span>
                      ) : (
                        <span>{survey.analytics.numDisplays - survey.analytics.numResponses}</span>
                      )}
                    </p>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>People who didn&apos;t respond to survey.</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <div className="flex flex-col justify-between lg:col-span-1">
            <div className="text-right text-xs text-slate-400">
              Last updated: {timeSinceConditionally(survey.updatedAt.toISOString())}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
