"use client";

import { getPastEngagementsAction } from "@/modules/discover/components/Engagements/actions";
import LoadingEngagementCard from "@/modules/discover/components/common/loading-card";
import { PastSurveyCard } from "@/modules/discover/components/common/past-survey-card";
import { TExtendedSurvey } from "@/modules/discover/types/survey";
import React, { useEffect, useState } from "react";

interface PastEngagementsProps {
  searchQuery: string;
  creatorId?: string;
  sortBy?: string;
}

export function PastEngagements({
  searchQuery,
  creatorId,
  sortBy = "updatedAt",
}: PastEngagementsProps): React.JSX.Element {
  const [pastEngagements, setPastEngagements] = useState<TExtendedSurvey[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setIsLoading(true);
      try {
        const pastEngagements = await getPastEngagementsAction({
          take: 10,
          skip: 0,
          searchQuery,
          creatorId,
          sortBy,
        });

        if (pastEngagements?.data) {
          setPastEngagements(pastEngagements.data);
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

  if (!pastEngagements || pastEngagements.length == 0) {
    return <div className="min-h-64"></div>;
  }

  return (
    <>
      {pastEngagements?.map((survey) => {
        return <PastSurveyCard type={"survey"} key={survey.id} survey={survey} />;
      })}
    </>
  );
}

export default PastEngagements;
