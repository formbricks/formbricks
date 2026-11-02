"use client";

import { ReactNode } from "react";
import { BaseCard } from "@/app/(app)/workspaces/[workspaceId]/surveys/[surveyId]/(analysis)/summary/components/base-card";

interface StatCardProps {
  readonly label: ReactNode;
  readonly percentage?: number | null;
  readonly value: ReactNode;
  readonly tooltipText?: ReactNode;
  readonly isLoading?: boolean;
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
