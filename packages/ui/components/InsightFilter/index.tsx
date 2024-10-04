"use client";

import { useState } from "react";
import { TInsight, TInsightCategory } from "@formbricks/types/insights";
import { SecondaryNavigation } from "../SecondaryNavigation";

interface InsightFilterProps {
  insights: TInsight[];
  setInsights: (insights: TInsight[]) => void;
}

export const InsightFilter = ({ insights, setInsights }: InsightFilterProps) => {
  const [selectedFilter, setSelectedFilter] = useState<string>("all");

  const handleFilterSelect = (filterValue: string) => {
    setSelectedFilter(filterValue);
    if (filterValue === "all") {
      setInsights(insights);
    } else {
      setInsights(insights.filter((insight) => insight.category === (filterValue as TInsightCategory)));
    }
  };

  const tabNavigation = [
    {
      id: "all",
      label: "All",
      onClick: () => handleFilterSelect("all"),
    },
    {
      id: "complaint",
      label: "Complaint",
      onClick: () => handleFilterSelect("complaint"),
    },
    {
      id: "featureRequest",
      label: "Feature Request",
      onClick: () => handleFilterSelect("featureRequest"),
    },
    {
      id: "praise",
      label: "Praise",
      onClick: () => handleFilterSelect("praise"),
    },
  ];

  return (
    <div className="mb-2 border-b border-slate-200">
      <SecondaryNavigation navigation={tabNavigation} activeId={selectedFilter} />
    </div>
  );
};
