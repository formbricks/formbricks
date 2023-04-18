"use client";

import EmptySpaceFiller from "@/components/shared/EmptySpaceFiller";
import LoadingSpinner from "@/components/shared/LoadingSpinner";
import { useResponses } from "@/lib/responses/responses";
import { useSurvey } from "@/lib/surveys/surveys";
import type { QuestionSummary } from "@formbricks/types/responses";
import { ErrorComponent } from "@formbricks/ui";
import { useMemo } from "react";
import MultipleChoiceSummary from "./MultipleChoiceSummary";
import OpenTextSummary from "./OpenTextSummary";

export default function SummaryList({ environmentId, surveyId }) {
  const { responsesData, isLoadingResponses, isErrorResponses } = useResponses(environmentId, surveyId);
  const { survey, isLoadingSurvey, isErrorSurvey } = useSurvey(environmentId, surveyId);

  const responses = responsesData?.responses;

  const summaryData: QuestionSummary[] = useMemo(() => {
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
    return <ErrorComponent />;
  }

  return (
    <>
      <div className="mt-10 space-y-8">
        {responses.length === 0 ? (
          <EmptySpaceFiller type="response" environmentId={environmentId} />
        ) : (
          <>
            {summaryData.map((questionSummary) => {
              if (questionSummary.question.type === "openText") {
                return (
                  <OpenTextSummary
                    key={questionSummary.question.id}
                    questionSummary={questionSummary}
                    environmentId={environmentId}
                  />
                );
              }
              if (questionSummary.question.type === "multipleChoiceSingle") {
                return (
                  <MultipleChoiceSummary
                    key={questionSummary.question.id}
                    questionSummary={questionSummary}
                  />
                );
              }
              return null;
            })}
          </>
        )}
      </div>
    </>
  );
}
