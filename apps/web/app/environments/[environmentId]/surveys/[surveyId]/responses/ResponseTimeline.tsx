"use client";

import EmptySpaceFiller from "@/components/shared/EmptySpaceFiller";
import LoadingSpinner from "@/components/shared/LoadingSpinner";
import { ErrorComponent } from "@formbricks/ui";
import { useResponses } from "@/lib/responses/responses";
import { useSurvey } from "@/lib/surveys/surveys";
import { useMemo } from "react";
import SingleResponse from "./SingleResponse";

export default function ResponseTimeline({ environmentId, surveyId }) {
  const { responses, isLoadingResponses, isErrorResponses } = useResponses(environmentId, surveyId);
  const { survey, isLoadingSurvey, isErrorSurvey } = useSurvey(environmentId, surveyId);

  const matchQandA = useMemo(() => {
    if (survey && responses) {
      // Create a mapping of question IDs to their headlines
      const questionIdToHeadline = {};
      survey.questions.forEach((question) => {
        questionIdToHeadline[question.id] = question.headline;
      });

      // Replace question IDs with question headlines in response data
      const updatedResponses = responses.map((response) => {
        const updatedData: Array<{ question: string; answer: string }> = []; // Specify the type of updatedData
        for (const [questionId, answer] of Object.entries(response.data)) {
          const questionHeadline = questionIdToHeadline[questionId];
          if (questionHeadline) {
            updatedData.push({ question: questionHeadline, answer: answer as string });
          }
        }
        return { ...response, data: updatedData };
      });

      return updatedResponses;
    }
    return [];
  }, [survey, responses]);

  if (isLoadingResponses || isLoadingSurvey) {
    return <LoadingSpinner />;
  }

  if (isErrorResponses || isErrorSurvey) {
    return <ErrorComponent />;
  }

  return (
    <div className="space-y-4">
      {responses.length === 0 ? (
        <EmptySpaceFiller type="response" environmentId={environmentId} />
      ) : (
        <div>
          {matchQandA.map((updatedResponse) => {
            return (
              <SingleResponse key={updatedResponse.id} data={updatedResponse} environmentId={environmentId} />
            );
          })}
        </div>
      )}
    </div>
  );
}
