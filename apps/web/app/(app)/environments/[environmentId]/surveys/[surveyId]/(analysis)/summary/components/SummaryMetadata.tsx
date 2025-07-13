"use client";

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/modules/ui/components/tooltip";
import { useTranslate } from "@tolgee/react";
import { ChevronDownIcon, ChevronUpIcon } from "lucide-react";
import { TSurveySummary } from "@formbricks/types/surveys/types";

interface SummaryMetadataProps {
  setShowDropOffs: React.Dispatch<React.SetStateAction<boolean>>;
  showDropOffs: boolean;
  surveySummary: TSurveySummary["meta"];
  isLoading: boolean;
}

const StatCard = ({ label, percentage, value, tooltipText, isLoading }) => {
  return (
    <TooltipProvider delayDuration={50}>
      <Tooltip>
        <TooltipTrigger>
          <div className="flex h-full cursor-default flex-col justify-between space-y-2 rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm">
            <p className="flex items-center gap-1 text-sm text-slate-600">
              {label}
              {typeof percentage === "number" && !isNaN(percentage) && !isLoading && (
                <span className="ml-1 rounded-xl bg-slate-100 px-2 py-1 text-xs">{percentage}%</span>
              )}
            </p>
            {isLoading ? (
              <div className="h-6 w-12 animate-pulse rounded-full bg-slate-200"></div>
            ) : (
              <p className="text-2xl font-bold text-slate-800">{value}</p>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p>{tooltipText}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

const formatTime = (ttc) => {
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
};

export const SummaryMetadata = ({
  setShowDropOffs,
  showDropOffs,
  surveySummary,
  isLoading,
}: SummaryMetadataProps) => {
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
  const { t } = useTranslate();
  const displayCountValue = dropOffCount === 0 ? <span>-</span> : dropOffCount;

  return (
    <div>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-5 md:gap-x-2 lg:col-span-4">
        <StatCard
          label={t("environments.surveys.summary.impressions")}
          percentage={null}
          value={displayCount === 0 ? <span>-</span> : displayCount}
          tooltipText={t("environments.surveys.summary.impressions_tooltip")}
          isLoading={isLoading}
        />
        <StatCard
          label={t("environments.surveys.summary.starts")}
          percentage={Math.round(startsPercentage) > 100 ? null : Math.round(startsPercentage)}
          value={totalResponses === 0 ? <span>-</span> : totalResponses}
          tooltipText={t("environments.surveys.summary.starts_tooltip")}
          isLoading={isLoading}
        />
        <StatCard
          label={t("environments.surveys.summary.completed")}
          percentage={Math.round(completedPercentage) > 100 ? null : Math.round(completedPercentage)}
          value={completedResponses === 0 ? <span>-</span> : completedResponses}
          tooltipText={t("environments.surveys.summary.completed_tooltip")}
          isLoading={isLoading}
        />

        <TooltipProvider delayDuration={50}>
          <Tooltip>
            <TooltipTrigger onClick={() => setShowDropOffs(!showDropOffs)} data-testid="dropoffs-toggle">
              <div className="flex h-full cursor-pointer flex-col justify-between space-y-2 rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm">
                <span className="text-sm text-slate-600">
                  {t("environments.surveys.summary.drop_offs")}
                  {`${Math.round(dropOffPercentage)}%` !== "NaN%" && !isLoading && (
                    <span className="ml-1 rounded-xl bg-slate-100 px-2 py-1 text-xs">{`${Math.round(dropOffPercentage)}%`}</span>
                  )}
                </span>
                <div className="flex w-full items-end justify-between">
                  <span className="text-2xl font-bold text-slate-800">
                    {isLoading ? (
                      <div className="h-6 w-12 animate-pulse rounded-full bg-slate-200"></div>
                    ) : (
                      displayCountValue
                    )}
                  </span>
                  {!isLoading && (
                    <div className="flex h-6 w-6 items-center justify-center rounded-md border border-slate-200 bg-slate-50 hover:bg-slate-100">
                      {showDropOffs ? (
                        <ChevronUpIcon className="h-4 w-4" />
                      ) : (
                        <ChevronDownIcon className="h-4 w-4" />
                      )}
                    </div>
                  )}
                </div>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p>{t("environments.surveys.summary.drop_offs_tooltip")}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <StatCard
          label={t("environments.surveys.summary.time_to_complete")}
          percentage={null}
          value={ttcAverage === 0 ? <span>-</span> : `${formatTime(ttcAverage)}`}
          tooltipText={t("environments.surveys.summary.ttc_tooltip")}
          isLoading={isLoading}
        />
      </div>
    </div>
  );
};
