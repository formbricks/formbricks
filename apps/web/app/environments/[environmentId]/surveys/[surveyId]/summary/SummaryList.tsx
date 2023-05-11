"use client";

import EmptySpaceFiller from "@/components/shared/EmptySpaceFiller";
import LoadingSpinner from "@/components/shared/LoadingSpinner";
import { useResponses } from "@/lib/responses/responses";
import { useSurvey } from "@/lib/surveys/surveys";
import type { QuestionSummary } from "@formbricks/types/responses";
import { ErrorComponent } from "@formbricks/ui";
import { useMemo } from "react";
import CTASummary from "./CTASummary";
import MultipleChoiceSummary from "./MultipleChoiceSummary";
import NPSSummary from "./NPSSummary";
import OpenTextSummary from "./OpenTextSummary";
import RatingSummary from "./RatingSummary";
import type {
  CTAQuestion,
  MultipleChoiceMultiQuestion,
  MultipleChoiceSingleQuestion,
  NPSQuestion,
  OpenTextQuestion,
  Question,
  RatingQuestion,
} from "@formbricks/types/questions";

export default function SummaryList({ environmentId, surveyId }) {
  const { responsesData, isLoadingResponses, isErrorResponses } = useResponses(environmentId, surveyId);
  const { survey, isLoadingSurvey, isErrorSurvey } = useSurvey(environmentId, surveyId);

  const responses = responsesData?.responses;

  const summaryData: QuestionSummary<Question>[] = useMemo(() => {
    if (survey && responses) {
      return survey.questions.map((question) => {
        const questionResponses = responses
          .filter((response) => question.id in response.data)
          .map((r) => ({
            id: r.id,
            value: r.data[question.id],
            updatedAt: r.updatedAt,
            personId: r.personId,
            person: r.person,
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
          <EmptySpaceFiller
            type="response"
            environmentId={environmentId}
            noWidgetRequired={survey.type === "link"}
          />
        ) : (
          <>
            {summaryData.map((questionSummary) => {
              if (questionSummary.question.type === "openText") {
                return (
                  <OpenTextSummary
                    key={questionSummary.question.id}
                    questionSummary={questionSummary as QuestionSummary<OpenTextQuestion>}
                    environmentId={environmentId}
                  />
                );
              }
              if (
                questionSummary.question.type === "multipleChoiceSingle" ||
                questionSummary.question.type === "multipleChoiceMulti"
              ) {
                return (
                  <MultipleChoiceSummary
                    key={questionSummary.question.id}
                    questionSummary={
                      questionSummary as QuestionSummary<
                        MultipleChoiceMultiQuestion | MultipleChoiceSingleQuestion
                      >
                    }
                  />
                );
              }
              if (questionSummary.question.type === "nps") {
                return (
                  <NPSSummary
                    key={questionSummary.question.id}
                    questionSummary={questionSummary as QuestionSummary<NPSQuestion>}
                  />
                );
              }
              if (questionSummary.question.type === "cta") {
                return (
                  <CTASummary
                    key={questionSummary.question.id}
                    questionSummary={questionSummary as QuestionSummary<CTAQuestion>}
                  />
                );
              }
              if (questionSummary.question.type === "rating") {
                return (
                  <RatingSummary
                    key={questionSummary.question.id}
                    questionSummary={questionSummary as QuestionSummary<RatingQuestion>}
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
