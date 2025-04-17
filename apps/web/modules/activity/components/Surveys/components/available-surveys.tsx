"use client";

import { getAvailableSurveysAction } from "@/modules/activity/components/Surveys/actions";
import { SurveyCard } from "@/modules/activity/components/common/survey-card";
import { Survey } from "@prisma/client";
import React, { useEffect, useState } from "react";

export function AvailableSurveys(): React.JSX.Element {
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

  return (
    <>
      {availableSurveys &&
        availableSurveys.map((survey) => {
          return <SurveyCard type={"survey"} key={survey.id} survey={survey} />;
        })}
    </>
  );
}

export default AvailableSurveys;
