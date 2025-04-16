"use client";

import { getAvailableSurveysAction } from "@/modules/activity/components/Surveys/actions";
import { SurveyCard } from "@/modules/activity/components/common/survey-card";
import { Survey } from "@prisma/client";
import React, { useEffect, useState } from "react";
import { cn } from "@formbricks/lib/cn";

export function AvailableSurveys({ className = "" }: { className?: string }): React.JSX.Element {
  const [availableSurveys, setAvailableSurveys] = useState<Survey[] | null>(null);

  useEffect(() => {
    (async () => {
      const availableSurveys = await getAvailableSurveysAction({
        take: 10,
        skip: 0,
      });
      if (availableSurveys?.data) {
        setAvailableSurveys(availableSurveys.data);
      }
    })();
  }, []);
  console.log(availableSurveys);
  return (
    <div className={cn("", className)}>
      {availableSurveys &&
        availableSurveys.map((survey) => {
          return <SurveyCard type={"survey"} key={survey.id} survey={survey} />;
        })}
    </div>
  );
}

export default AvailableSurveys;
