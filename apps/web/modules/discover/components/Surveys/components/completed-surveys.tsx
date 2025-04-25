"use client";

import { getCompletedSurveysAction } from "@/modules/discover/components/Surveys/actions";
import { CompletedSurveyCard } from "@/modules/discover/components/common/completed-survey-card";
import { TExtendedSurvey } from "@/modules/discover/types/survey";
import React, { useEffect, useState } from "react";

export function CompletedSurveys(): React.JSX.Element {
  const [completedSurveys, setCompletedSurveys] = useState<TExtendedSurvey[] | null>(null);

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
    <>
      {completedSurveys &&
        completedSurveys.map((survey) => {
          return <CompletedSurveyCard key={survey.id} survey={survey} />;
        })}
    </>
  );
}

export default CompletedSurveys;
