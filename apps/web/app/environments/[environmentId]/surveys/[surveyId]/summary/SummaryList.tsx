"use client";

import EmptySpaceFiller from "@/components/shared/EmptySpaceFiller";
import LoadingSpinner from "@/components/shared/LoadingSpinner";
import { Confetti } from "@formbricks/ui";
import { ErrorComponent } from "@formbricks/ui";
import { useResponses } from "@/lib/responses/responses";
import { useSurvey } from "@/lib/surveys/surveys";
import type { QuestionSummary } from "@formbricks/types/responses";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import MultipleChoiceSummary from "./MultipleChoiceSummary";
import OpenTextSummary from "./OpenTextSummary";

export default function SummaryList({ environmentId, surveyId }) {
  const { responses, isLoadingResponses, isErrorResponses } = useResponses(environmentId, surveyId);
  const { survey, isLoadingSurvey, isErrorSurvey } = useSurvey(environmentId, surveyId);
  const [confetti, setConfetti] = useState(false);
  const searchParams = useSearchParams();

  useEffect(() => {
    if (searchParams) {
      const newSurveyParam = searchParams.get("success");
      if (newSurveyParam === "true") {
        setConfetti(true);
        toast.success("Congrats! Your survey is live 🎉", {
          duration: 4000,
          position: "bottom-right",
        });
      }
    }
  }, [searchParams]);

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
        {confetti && <Confetti />}
      </div>
    </>
  );
}
