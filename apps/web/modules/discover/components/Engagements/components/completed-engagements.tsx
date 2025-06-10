"use client";

import { getCompletedSurveysAction } from "@/modules/discover/components/Engagements/actions";
import { CompletedSurveyCard } from "@/modules/discover/components/common/completed-survey-card";
import { LoadingEngagementCard } from "@/modules/discover/components/common/loading-card";
import { NoCompletedEngagements } from "@/modules/discover/components/common/no-completed-engagements";
import { TExtendedSurvey } from "@/modules/discover/types/survey";
import React, { useEffect, useState } from "react";

interface CompletedSurveysProps {
  searchQuery: string;
  creatorId?: string;
  setActiveTab?: (id: string) => void;
  sortBy?: string;
  showEmptyBorder?: boolean;
}

export function CompletedSurveys({
  searchQuery,
  creatorId,
  setActiveTab,
  sortBy = "updatedAt",
  showEmptyBorder = true,
}: CompletedSurveysProps): React.JSX.Element {
  const [completedSurveys, setCompletedSurveys] = useState<TExtendedSurvey[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setIsLoading(true);
      try {
        const completedSurveys = await getCompletedSurveysAction({
          take: 10,
          skip: 0,
          searchQuery: searchQuery,
          creatorId: creatorId,
          sortBy: sortBy,
        });

        if (completedSurveys?.data) {
          setCompletedSurveys(completedSurveys.data);
        }
      } catch (error) {
        console.error("Error fetching available surveys:", error);
      } finally {
        setIsLoading(false);
      }
    })();
  }, [searchQuery, creatorId, sortBy]);

  if (isLoading) {
    return (
      <>
        <LoadingEngagementCard />
        <LoadingEngagementCard />
        <LoadingEngagementCard />
      </>
    );
  }

  if (!completedSurveys || completedSurveys.length == 0) {
    return <NoCompletedEngagements setActiveTab={setActiveTab} border={showEmptyBorder} />;
  }

  return (
    <>
      {completedSurveys &&
        completedSurveys.map((survey) => {
          return <CompletedSurveyCard key={survey.id} survey={survey} />;
        })}
    </>
  );
}

export default CompletedSurveys;
