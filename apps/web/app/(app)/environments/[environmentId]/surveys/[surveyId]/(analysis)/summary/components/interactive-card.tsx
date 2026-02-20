"use client";

import { ChevronDownIcon, ChevronUpIcon } from "lucide-react";
import { BaseCard } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/components/base-card";

interface InteractiveCardProps {
  tab: "dropOffs" | "quotas" | "impressions";
  label: string;
  percentage: number | null;
  value: React.ReactNode;
  tooltipText: string;
  isLoading: boolean;
  onClick: () => void;
  isActive: boolean;
}

export const InteractiveCard = ({
  tab,
  label,
  percentage,
  value,
  tooltipText,
  isLoading,
  onClick,
  isActive,
}: InteractiveCardProps) => {
  return (
    <BaseCard
      label={label}
      percentage={percentage}
      tooltipText={tooltipText}
      isLoading={isLoading}
      onClick={onClick}
      testId={`${tab}-toggle`}
      id={`${tab}-toggle`}>
      <div className="flex w-full items-end justify-between">
        <span className="text-2xl font-bold text-slate-800">
          {isLoading ? <div className="h-6 w-12 animate-pulse rounded-full bg-slate-200"></div> : value}
        </span>
        {!isLoading && (
          <div className="flex h-6 w-6 items-center justify-center rounded-md border border-slate-200 bg-slate-50 hover:bg-slate-100">
            {isActive ? <ChevronUpIcon className="h-4 w-4" /> : <ChevronDownIcon className="h-4 w-4" />}
          </div>
        )}
      </div>
    </BaseCard>
  );
};
