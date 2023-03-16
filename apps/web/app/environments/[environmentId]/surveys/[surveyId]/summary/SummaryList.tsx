"use client";

import OpenTextSummary from "./OpenTextSummary";
import RadioSummary from "./RadioSummary";
import { useResponses } from "@/lib/responses/responses";
import LoadingSpinner from "@/components/shared/LoadingSpinner";
import { useSurvey } from "@/lib/surveys/surveys";
import { useMemo } from "react";

export default function SummaryList({ environmentId, surveyId }) {
  const { responses, isLoadingResponses, isErrorResponses } = useResponses(environmentId, surveyId);
  const { survey, isLoadingSurvey, isErrorSurvey } = useSurvey(environmentId, surveyId);

  const summaryData = useMemo(() => {
    if (survey && responses) {
      return survey.questions.map((question) => {
        const questionResponses = responses
          .filter((response) => question.id in response.data)
          .map((r) => ({
            id: r.id,
            value: r.data[question.id],
            updatedAt: r.updatedAt,
            personId: r.personId,
          }));
        return {
          question,
          responses: questionResponses,
        };
      });
    }
    return [];
  }, [survey, responses]);

  if (isLoadingResponses || isLoadingSurvey) {
    return <LoadingSpinner />;
  }

  if (isErrorResponses || isErrorSurvey) {
    return <div>Error</div>;
  }

  console.log("survey", survey);
  console.log("responses", responses);
  console.log("summaryData", JSON.stringify(summaryData, null, 2));

  return (
    <div className="space-y-4">
      {summaryData.map((data) => {
        if (data.question.type === "openText") {
          return <OpenTextSummary key={data.question.id} data={data} environmentId={environmentId} />;
        }
        /*       if (data.question.type === "radio") {
          return <RadioSummary key={data.question.id} data={data} />;
        } */
        return null;
      })}
    </div>
  );
}
