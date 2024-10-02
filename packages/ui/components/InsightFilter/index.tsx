"use client";

import { useState } from "react";
import { cn } from "@formbricks/lib/cn";
import { TInsight, TInsightCategory } from "@formbricks/types/insights";

interface InsightFilterProps {
  insights: TInsight[];
  setInsights: (insights: TInsight[]) => void;
}

export const InsightFilter = ({ insights, setInsights }: InsightFilterProps) => {
  const [selectedFilter, setSelectedFilter] = useState<string>("all");

  const filters = [
    {
      label: "All",
      value: "all",
    },
    {
      label: "Complaint",
      value: "complaint",
    },
    {
      label: "Feature Request",
      value: "featureRequest",
    },
    {
      label: "Praise",
      value: "praise",
    },
  ];

  const handleFilterSelect = (filterValue: string) => {
    setSelectedFilter(filterValue);
    if (filterValue === "all") {
      setInsights(insights);
    } else {
      setInsights(insights.filter((insight) => insight.category === (filterValue as TInsightCategory)));
    }
  };

  return (
    <div className="flex gap-1">
      {filters.map((filter) => (
        <button
          key={filter.value}
          type="button"
          onClick={() => handleFilterSelect(filter.value)}
          className={cn(
            selectedFilter === filter.value
              ? "bg-slate-800 font-semibold text-white"
              : "bg-white text-slate-700 hover:bg-slate-100 focus:scale-105 focus:bg-slate-100 focus:outline-none focus:ring-0",
            "rounded border border-slate-800 px-2 py-1 text-xs transition-all duration-150"
          )}>
          {filter.label}
        </button>
      ))}
    </div>
  );
};
