"use client";

import { getCompletedSurveysAction } from "@/modules/activity/components/Surveys/actions";
import { CompletedSurveyCard } from "@/modules/activity/components/common/completed-survey-card";
import React, { useEffect, useState } from "react";
import { TSurvey } from "@formbricks/types/surveys/types";

export function CompletedSurveys(): React.JSX.Element {
  const [completedSurveys, setCompletedSurveys] = useState<TSurvey[] | null>(null);

  useEffect(() => {
    (async () => {
      const completedSurveys = await getCompletedSurveysAction({
        take: 10,
        skip: 0,
      });
      if (completedSurveys?.data) {
        setCompletedSurveys(completedSurveys.data as TSurvey[]);
      }
    })();
  }, []);

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
