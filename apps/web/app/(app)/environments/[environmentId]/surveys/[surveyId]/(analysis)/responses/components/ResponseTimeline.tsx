"use client";
import EmptySpaceFiller from "@/components/shared/EmptySpaceFiller";
import { TResponse } from "@formbricks/types/v1/responses";
import { TSurvey } from "@formbricks/types/v1/surveys";
import { createId } from "@paralleldrive/cuid2";
import { useMemo } from "react";
import SingleResponse from "./SingleResponse";
import EmptyInAppSurveys from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/components/EmptyInAppSurveys";
import { TEnvironment } from "@formbricks/types/v1/environment";
import { TTag } from "@formbricks/types/v1/tags";

interface ResponseTimelineProps {
  environment: TEnvironment;
  surveyId: string;
  responses: TResponse[];
  survey: TSurvey;
  environmentTags: TTag[];
}

export default function ResponseTimeline({
  environment,
  surveyId,
  responses,
  survey,
  environmentTags,
}: ResponseTimelineProps) {
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
          id: string;
          question: string;
          answer: string;
          type: string;
          scale?: "number" | "star" | "smiley";
          range?: number;
        }> = []; // Specify the type of updatedData
        // iterate over survey questions and build the updated response
        for (const question of survey.questions) {
          const answer = response.data[question.id];
          if (answer !== null && answer !== undefined) {
            updatedResponse.push({
              id: createId(),
              question: question.headline,
              type: question.type,
              scale: question.scale,
              range: question.range,
              answer: answer as string,
            });
          }
        }
        return { ...response, responses: updatedResponse };
      });

      const updatedResponsesWithTags = updatedResponses.map((response) => ({
        ...response,
        tags: response.tags?.map((tag) => tag),
      }));

      return updatedResponsesWithTags;
    }
    return [];
  }, [survey, responses]);

  return (
    <div className="space-y-4">
      {survey.type === "web" && responses.length === 0 && (
        <EmptyInAppSurveys environmentId={environment.id} />
      )}
      {survey.type !== "web" && responses.length === 0 ? (
        <EmptySpaceFiller
          type="response"
          environment={environment}
          noWidgetRequired={survey.type === "link"}
        />
      ) : (
        <div>
          {matchQandA.map((updatedResponse) => {
            return (
              <SingleResponse
                key={updatedResponse.id}
                data={updatedResponse}
                surveyId={surveyId}
                environmentId={environment.id}
                environmentTags={environmentTags}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
