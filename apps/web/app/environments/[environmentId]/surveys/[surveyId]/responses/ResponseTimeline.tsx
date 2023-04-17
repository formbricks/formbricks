"use client";

import EmptySpaceFiller from "@/components/shared/EmptySpaceFiller";
import LoadingSpinner from "@/components/shared/LoadingSpinner";
import { ErrorComponent } from "@formbricks/ui";
import { useResponses } from "@/lib/responses/responses";
import { useSurvey } from "@/lib/surveys/surveys";
import { useMemo } from "react";
import SingleResponse from "./SingleResponse";

export default function ResponseTimeline({ environmentId, surveyId }) {
  const { responsesData, isLoadingResponses, isErrorResponses } = useResponses(environmentId, surveyId);
  const { survey, isLoadingSurvey, isErrorSurvey } = useSurvey(environmentId, surveyId);

  const responses = responsesData?.responses;

  const matchQandA = useMemo(() => {
    if (survey && responses) {
      // Create a mapping of question IDs to their headlines
      const questionIdToHeadline = {};
      survey.questions.forEach((question) => {
        questionIdToHeadline[question.id] = question.headline;
      });

      // Replace question IDs with question headlines in response data
      const updatedResponses = responses.map((response) => {
        const updatedResponse: Array<{ question: string; answer: string }> = []; // Specify the type of updatedData
        // iterate over survey questions and build the updated response
        for (const question of survey.questions) {
          const questionId = question.id;
          const questionHeadline = question.headline;
          const answer = response.data[questionId];
          if (answer) {
            updatedResponse.push({ question: questionHeadline, answer: answer as string });
          }
        }
        return { ...response, responses: updatedResponse };
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
