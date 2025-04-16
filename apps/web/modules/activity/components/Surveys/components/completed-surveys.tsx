"use client";

import { getCompletedSurveysAction } from "@/modules/activity/components/Surveys/actions";
import { SurveyCard } from "@/modules/activity/components/common/survey-card";
import { Survey } from "@prisma/client";
import React, { useEffect, useState } from "react";
import { cn } from "@formbricks/lib/cn";

export function CompletedSurveys({ className = "" }: { className?: string }): React.JSX.Element {
  const [completedSurveys, setCompletedSurveys] = useState<Survey[] | null>(null);

  useEffect(() => {
    (async () => {
      const completedSurveys = await getCompletedSurveysAction({
        take: 10,
        skip: 0,
      });
      if (completedSurveys?.data) {
        setCompletedSurveys(completedSurveys.data);
      }
    })();
  }, []);

  return (
    <div className={cn("", className)}>
      {completedSurveys &&
        completedSurveys.map((survey) => {
          return <SurveyCard key={survey.id} survey={survey} />;
        })}
    </div>
  );
}

export default CompletedSurveys;
