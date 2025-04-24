"use client";

import { getAvailableSurveysAction } from "@/modules/discover/components/Surveys/actions";
import { ActiveSurveyCard } from "@/modules/discover/components/common/active-survey-card";
import React, { useEffect, useState } from "react";
import { TSurvey } from "@formbricks/types/surveys/types";

export function AvailableSurveys(): React.JSX.Element {
  const [availableSurveys, setAvailableSurveys] = useState<TSurvey[] | null>(null);

  useEffect(() => {
    (async () => {
      const availableSurveys = await getAvailableSurveysAction({
        take: 10,
        skip: 0,
      });

      if (availableSurveys && availableSurveys.data) {
        setAvailableSurveys(availableSurveys.data as TSurvey[]);
      }
    })();
  }, []);

  return (
    <>
      {availableSurveys &&
        availableSurveys.map((survey) => {
          return <ActiveSurveyCard type={"survey"} key={survey.id} survey={survey} />;
        })}
    </>
  );
}

export default AvailableSurveys;
