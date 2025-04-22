"use client";

import { getCompletedSurveysAction } from "@/modules/activity/components/Surveys/actions";
import { SurveyCard } from "@/modules/activity/components/common/survey-card";
import { Survey } from "@prisma/client";
import React, { useEffect, useState } from "react";

export function CompletedSurveys(): React.JSX.Element {
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
    <>
      {completedSurveys &&
        completedSurveys.map((survey) => {
          return <SurveyCard type={"survey"} key={survey.id} survey={survey} />;
        })}
    </>
  );
}

export default CompletedSurveys;
