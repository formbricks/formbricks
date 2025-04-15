"use client";

import { Survey } from "@prisma/client";
import React, { useEffect, useState } from "react";
import { cn } from "@formbricks/lib/cn";
import { getAvailableSurveysAction, getCompletedSurveysAction } from "./actions";

export function AvailableSurveys({ className = "" }: { className?: string }): React.JSX.Element {
  const [availableSurveys, setAvailableSurveys] = useState<Survey[] | null>(null);
  const [completedSurveys, setCompletedSurveys] = useState<Survey[] | null>(null);

  useEffect(() => {
    (async () => {
      const availableSurveys = await getAvailableSurveysAction({
        take: 10,
        skip: 0,
      });
      if (availableSurveys?.data) {
        setAvailableSurveys(availableSurveys.data);
      }
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
      <div
        className={cn(
          "relative my-4 flex w-full flex-col gap-4 rounded-xl border border-slate-200 bg-white px-4 py-4 text-left shadow-sm md:flex-row",
          className
        )}
        id={"surveys"}>
        <pre>{JSON.stringify(availableSurveys, null, 2)}</pre>
        <pre>{JSON.stringify(completedSurveys, null, 2)}</pre>
      </div>
    </>
  );
}

export default AvailableSurveys;
