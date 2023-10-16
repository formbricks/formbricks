import { timeSinceConditionally } from "@formbricks/lib/time";
import { TResponse } from "@formbricks/types/v1/responses";
import { TSurveyWithAnalytics } from "@formbricks/types/v1/surveys";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@formbricks/ui/Tooltip";

interface SummaryMetadataProps {
  responses: TResponse[];
  survey: TSurveyWithAnalytics;
}

const StatCard = ({ label, percentage = "", value, tooltipText }) => (
  <TooltipProvider delayDuration={50}>
    <Tooltip>
      <TooltipTrigger>
        <div className="flex h-full cursor-default flex-col justify-between space-y-2 rounded-lg border border-slate-200 bg-white p-4 text-left shadow-sm">
          <p className="text-sm text-slate-600">
            {label}
            {percentage && percentage !== "NaN%" && (
              <span className="ml-1 rounded-xl bg-slate-100 px-2 py-1 text-xs">{percentage}</span>
            )}
          </p>
          <p className="text-2xl font-bold text-slate-800">{value}</p>
        </div>
      </TooltipTrigger>
      <TooltipContent>
        <p>{tooltipText}</p>
      </TooltipContent>
    </Tooltip>
  </TooltipProvider>
);

export default function SummaryMetadata({ responses, survey }: SummaryMetadataProps) {
  const completedResponses = responses.filter((r) => r.finished).length;
  const totalResponses = responses.length;
  const totalDisplays = survey.analytics.numDisplays;
  let averageTimeToCompletion = 0;
  // computes the average time to completion by performing a cumulative average
  if (survey.latestTimeToCompletionSample && survey.cumulativeTimeToCompletion) {
    averageTimeToCompletion =
      (survey.latestTimeToCompletionSample + survey.cumulativeTimeToCompletion * responses.length) /
      (responses.length + 1);
  }

  console.log(survey.latestTimeToCompletionSample);

  return (
    <div className="mb-4">
      <div className="flex flex-col-reverse gap-y-2 lg:grid lg:grid-cols-4 lg:gap-x-2">
        <div className="grid grid-cols-2 gap-4 md:grid md:grid-cols-4 md:gap-x-2 lg:col-span-3 lg:grid lg:grid-cols-6 lg:gap-x-2">
          <div className="flex flex-col justify-between space-y-2 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-sm text-slate-600">Displays</p>
            <p className="text-2xl font-bold text-slate-800">
              {totalDisplays === 0 ? <span>-</span> : totalDisplays}
            </p>
          </div>
          <StatCard
            label="Starts"
            percentage={`${Math.round((totalResponses / totalDisplays) * 100)}%`}
            value={totalResponses === 0 ? <span>-</span> : totalResponses}
            tooltipText="People who started the survey."
          />
          <StatCard
            label="Responses"
            percentage={`${Math.round((completedResponses / totalDisplays) * 100)}%`}
            value={responses.length === 0 ? <span>-</span> : completedResponses}
            tooltipText="People who completed the survey."
          />
          <StatCard
            label="Drop Offs"
            percentage={`${Math.round(((totalResponses - completedResponses) / totalResponses) * 100)}%`}
            value={responses.length === 0 ? <span>-</span> : totalResponses - completedResponses}
            tooltipText="People who started but not completed the survey."
          />
          <StatCard
            label="Avg. Time to Complete"
            value={responses.length === 0 ? <span>-</span> : averageTimeToCompletion}
            tooltipText="Average time to complete the survey."
          />
        </div>
        <div className="flex flex-col justify-between lg:col-span-1">
          <div className="text-right text-xs text-slate-400">
            Last updated: {timeSinceConditionally(survey.updatedAt.toISOString())}
          </div>
        </div>
      </div>
    </div>
  );
}
