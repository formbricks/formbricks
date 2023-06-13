"use client";

import EmptySpaceFiller from "@/components/shared/EmptySpaceFiller";
import LoadingSpinner from "@/components/shared/LoadingSpinner";
import { useResponses } from "@/lib/responses/responses";
import { useSurvey } from "@/lib/surveys/surveys";
import { Button, ErrorComponent } from "@formbricks/ui";
import { useMemo } from "react";
import SingleResponse from "./SingleResponse";
import { convertToCSV } from "@/lib/csvConversion";
import { useCallback } from "react";

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
        const updatedResponse: Array<{
          question: string;
          answer: string;
          type: string;
          scale?: "number" | "star" | "smiley";
          range?: number;
        }> = []; // Specify the type of updatedData
        // iterate over survey questions and build the updated response
        for (const question of survey.questions) {
          const answer = response.data[question.id];
          if (answer) {
            updatedResponse.push({
              question: question.headline,
              type: question.type,
              scale: question.scale,
              range: question.range,
              answer: answer as string,
            });
          }
        }
        return { ...response, responses: updatedResponse, person: response.person };
      });
      return updatedResponses;
    }
    return [];
  }, [survey, responses]);

  const downloadResponses = useCallback(async () => {
    let fieldsForCSV: string[] = [];
    fieldsForCSV = matchQandA.forEach((response) => {
      const { responses } = response;
      responses.forEach(() => {
        fieldsForCSV.push("response.question");
        fieldsForCSV.push("response.answer");
      });
    });

    const response = await convertToCSV({
      json: matchQandA,
      fields: fieldsForCSV,
    });

    // console.log({ response });

    // Create a temporary link element to trigger the download
    const link = document.createElement("a");
    link.href = response.downloadUrl;
    link.download = "survey_responses.csv";

    // Append the link to the DOM and click it to start the download
    document.body.appendChild(link);
    link.click();

    // Clean up by removing the temporary link
    document.body.removeChild(link);

    // Revoke the download URL
    URL.revokeObjectURL(response.downloadUrl);
  }, [matchQandA]);

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
          <Button onClick={() => downloadResponses()}>Download</Button>
          {matchQandA.map((updatedResponse) => {
            return (
              <SingleResponse
                key={updatedResponse.id}
                data={updatedResponse}
                surveyId={surveyId}
                environmentId={environmentId}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
