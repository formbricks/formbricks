"use client";

import { getAvailableSurveysAction } from "@/modules/discover/components/Engagements/actions";
import { AvailableSurveyCard } from "@/modules/discover/components/common/available-survey-card";
import LoadingEngagementCard from "@/modules/discover/components/common/loading-card";
import { TExtendedSurvey } from "@/modules/discover/types/survey";
import React, { useEffect, useState } from "react";

interface AvailableEngagementsProps {
  searchQuery: string;
  creatorId?: string;
  sortBy?: string;
}

export function AvailableEngagements({
  searchQuery,
  creatorId,
  sortBy = "updatedAt",
}: AvailableEngagementsProps): React.JSX.Element {
  const [availableEngagements, setAvailableEngagements] = useState<TExtendedSurvey[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setIsLoading(true);
      try {
        const availableEngagements = await getAvailableSurveysAction({
          take: 10,
          skip: 0,
          searchQuery,
          creatorId,
          sortBy,
        });

        if (availableEngagements?.data) {
          setAvailableEngagements(availableEngagements.data);
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

  return (
    <>
      {availableEngagements &&
        availableEngagements.map((survey) => {
          return <AvailableSurveyCard type={"survey"} key={survey.id} survey={survey} />;
        })}
    </>
  );
}

export default AvailableEngagements;
