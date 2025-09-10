"use client";

import { BaseCard } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/components/base-card";
import { ReactNode } from "react";

interface StatCardProps {
  label: ReactNode;
  percentage?: number | null;
  value: ReactNode;
  tooltipText?: ReactNode;
  isLoading?: boolean;
}

export const StatCard = ({
  label,
  percentage = null,
  value,
  tooltipText,
  isLoading = false,
}: StatCardProps) => {
  return (
    <BaseCard label={label} percentage={percentage} tooltipText={tooltipText} isLoading={isLoading}>
      {isLoading ? (
        <div className="h-6 w-12 animate-pulse rounded-full bg-slate-200"></div>
      ) : (
        <p className="text-2xl font-bold text-slate-800">{value}</p>
      )}
    </BaseCard>
  );
};
