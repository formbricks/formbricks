import { ChevronDownIcon, ChevronUpIcon } from "lucide-react";

import { timeSinceConditionally } from "@formbricks/lib/time";
import { TSurveySummary } from "@formbricks/types/responses";
import { TSurvey } from "@formbricks/types/surveys";
import { Button } from "@formbricks/ui/Button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@formbricks/ui/Tooltip";

interface SummaryMetadataProps {
  survey: TSurvey;
  setShowDropOffs: React.Dispatch<React.SetStateAction<boolean>>;
  showDropOffs: boolean;
  surveySummary: TSurveySummary["meta"];
}

const StatCard = ({ label, percentage, value, tooltipText }) => (
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

function formatTime(ttc) {
  const seconds = ttc / 1000;
  let formattedValue;

  if (seconds >= 60) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    formattedValue = `${minutes}m ${remainingSeconds.toFixed(2)}s`;
  } else {
    formattedValue = `${seconds.toFixed(2)}s`;
  }

  return formattedValue;
}

export default function SummaryMetadata({
  survey,
  setShowDropOffs,
  showDropOffs,
  surveySummary,
}: SummaryMetadataProps) {
  const {
    completedPercentage,
    completedResponses,
    displayCount,
    dropOffPercentage,
    dropOffCount,
    startsPercentage,
    totalResponses,
    ttcAverage,
  } = surveySummary;

  return (
    <div className="mb-4">
      <div className="flex flex-col-reverse gap-y-2 lg:grid lg:grid-cols-3 lg:gap-x-2">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-5 md:gap-x-2 lg:col-span-2">
          <StatCard
            label="Displays"
            percentage={null}
            value={displayCount === 0 ? <span>-</span> : displayCount}
            tooltipText="Number of times the survey has been viewed."
          />
          <StatCard
            label="Starts"
            percentage={`${Math.round(startsPercentage)}%`}
            value={totalResponses === 0 ? <span>-</span> : totalResponses}
            tooltipText="Number of times the survey has been started."
          />
          <StatCard
            label="Responses"
            percentage={`${Math.round(completedPercentage)}%`}
            value={completedResponses === 0 ? <span>-</span> : completedResponses}
            tooltipText="Number of times the survey has been completed."
          />
          <StatCard
            label="Drop Offs"
            percentage={`${Math.round(dropOffPercentage)}%`}
            value={dropOffCount === 0 ? <span>-</span> : dropOffCount}
            tooltipText="Number of times the survey has been started but not completed."
          />
          <StatCard
            label="Time to Complete"
            percentage={null}
            value={ttcAverage === 0 ? <span>-</span> : `${formatTime(ttcAverage)}`}
            tooltipText="Average time to complete the survey."
          />
        </div>
        <div className="flex flex-col justify-between gap-2 lg:col-span-1">
          <div className="text-right text-xs text-slate-400">
            Last updated: {timeSinceConditionally(survey.updatedAt.toISOString())}
          </div>
          <Button
            variant="minimal"
            className="w-max self-start"
            EndIcon={showDropOffs ? ChevronDownIcon : ChevronUpIcon}
            onClick={() => setShowDropOffs(!showDropOffs)}>
            Analyze Drop Offs
          </Button>
        </div>
      </div>
    </div>
  );
}
