"use client";

import { useTranslation } from "react-i18next";
import { TSurveySummary } from "@formbricks/types/surveys/types";
import { InteractiveCard } from "@/app/(app)/workspaces/[workspaceId]/surveys/[surveyId]/(analysis)/summary/components/interactive-card";
import { StatCard } from "@/app/(app)/workspaces/[workspaceId]/surveys/[surveyId]/(analysis)/summary/components/stat-card";
import { cn } from "@/modules/ui/lib/utils";

interface SummaryMetadataProps {
  surveySummary: TSurveySummary["meta"];
  quotasCount: number;
  isLoading: boolean;
  tab: "dropOffs" | "quotas" | "impressions" | undefined;
  setTab: React.Dispatch<React.SetStateAction<"dropOffs" | "quotas" | "impressions" | undefined>>;
  isQuotasAllowed: boolean;
}

const formatTime = (ttc: number) => {
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
  surveySummary,
  quotasCount,
  isLoading,
  tab,
  setTab,
  isQuotasAllowed,
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
    quotasCompleted,
    quotasCompletedPercentage,
  } = surveySummary;
  const { t } = useTranslation();
  const dropoffCountValue = dropOffCount === 0 ? <span>-</span> : dropOffCount;

  const handleTabChange = (val: "dropOffs" | "quotas" | "impressions") => {
    const change = tab === val ? undefined : val;
    setTab(change);
  };

  return (
    <div>
      <div
        className={cn(
          `grid gap-4 sm:grid-cols-2 md:grid-cols-3 md:gap-x-2 lg:grid-cols-3 2xl:grid-cols-5`,
          isQuotasAllowed && quotasCount > 0 && "2xl:grid-cols-6"
        )}>
        <InteractiveCard
          key="impressions"
          tab="impressions"
          label={t("workspace.surveys.summary.impressions")}
          percentage={null}
          value={displayCount === 0 ? <span>-</span> : displayCount}
          tooltipText={t("workspace.surveys.summary.impressions_tooltip")}
          isLoading={isLoading}
          onClick={() => handleTabChange("impressions")}
          isActive={tab === "impressions"}
        />
        <StatCard
          label={t("workspace.surveys.summary.starts")}
          percentage={Math.round(startsPercentage) > 100 ? null : Math.round(startsPercentage)}
          value={totalResponses === 0 ? <span>-</span> : totalResponses}
          tooltipText={t("workspace.surveys.summary.starts_tooltip")}
          isLoading={isLoading}
        />
        <StatCard
          label={t("workspace.surveys.summary.completed")}
          percentage={Math.round(completedPercentage) > 100 ? null : Math.round(completedPercentage)}
          value={completedResponses === 0 ? <span>-</span> : completedResponses}
          tooltipText={t("workspace.surveys.summary.completed_tooltip")}
          isLoading={isLoading}
        />

        <InteractiveCard
          key="dropOffs"
          tab="dropOffs"
          label={t("workspace.surveys.summary.drop_offs")}
          percentage={dropOffPercentage}
          value={dropoffCountValue}
          tooltipText={t("workspace.surveys.summary.drop_offs_tooltip")}
          isLoading={isLoading}
          onClick={() => handleTabChange("dropOffs")}
          isActive={tab === "dropOffs"}
        />

        <StatCard
          label={t("workspace.surveys.summary.time_to_complete")}
          percentage={null}
          value={ttcAverage === 0 ? <span>-</span> : `${formatTime(ttcAverage)}`}
          tooltipText={t("workspace.surveys.summary.ttc_survey_tooltip", {
            defaultValue: "Average time to complete the survey.",
          })}
          isLoading={isLoading}
        />

        {isQuotasAllowed && quotasCount > 0 && (
          <InteractiveCard
            key="quotas"
            tab="quotas"
            label={t("workspace.surveys.summary.quotas_completed")}
            percentage={quotasCompletedPercentage}
            value={quotasCompleted}
            tooltipText={t("workspace.surveys.summary.quotas_completed_tooltip")}
            isLoading={isLoading}
            onClick={() => handleTabChange("quotas")}
            isActive={tab === "quotas"}
          />
        )}
      </div>
    </div>
  );
};
