"use client";

import { getAvailableSurveysAction } from "@/modules/discover/components/Surveys/actions";
import { AvailableSurveyCard } from "@/modules/discover/components/common/available-survey-card";
import { TExtendedSurvey } from "@/modules/discover/types/survey";
import React, { useEffect, useState } from "react";

export function AvailableSurveys(): React.JSX.Element {
  const [availableSurveys, setAvailableSurveys] = useState<TExtendedSurvey[] | null>(null);

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
          return <AvailableSurveyCard type={"survey"} key={survey.id} survey={survey} />;
        })}
    </>
  );
}

export default AvailableSurveys;
