"use client";

import { getAvailableSurveysAction } from "@/modules/discover/components/Engagements/actions";
import { AvailableSurveyCard } from "@/modules/discover/components/common/available-survey-card";
import LoadingEngagementCard from "@/modules/discover/components/common/loading-card";
import { TExtendedSurvey } from "@/modules/discover/types/survey";
import React, { useEffect, useState } from "react";

interface AvailableSurveysProps {
  searchQuery: string;
}

export function AvailableSurveys({ searchQuery }: AvailableSurveysProps): React.JSX.Element {
  const [availableSurveys, setAvailableSurveys] = useState<TExtendedSurvey[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setIsLoading(true);
      try {
        const availableSurveys = await getAvailableSurveysAction({
          take: 10,
          skip: 0,
          searchQuery: searchQuery,
        });

        if (availableSurveys?.data) {
          setAvailableSurveys(availableSurveys.data);
        }
      } catch (error) {
        console.error("Error fetching available surveys:", error);
      } finally {
        setIsLoading(false);
      }
    })();
  }, [searchQuery]);

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
      {availableSurveys &&
        availableSurveys.map((survey) => {
          return <AvailableSurveyCard type={"survey"} key={survey.id} survey={survey} />;
        })}
    </>
  );
}

export default AvailableSurveys;
