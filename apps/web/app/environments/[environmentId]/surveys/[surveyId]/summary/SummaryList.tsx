"use client";

import EmptySpaceFiller from "@/components/shared/EmptySpaceFiller";
import LoadingSpinner from "@/components/shared/LoadingSpinner";
import ToasterClient from "@/components/ToasterClient";
import { Confetti } from "@/components/ui/Confetti";
import { useResponses } from "@/lib/responses/responses";
import { useSurvey } from "@/lib/surveys/surveys";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
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
        // added to see both the timeout and confetti
        setTimeout(() => {
          setConfetti(true);
          toast.success("Congrats! Your survey is live 🎉", {
            duration: 4000,
            position: "bottom-right",
          });
        }, 300);
      }
    }
  }, [searchParams]);

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

  return (
    <>
      <div className="space-y-4">
        {responses.length === 0 ? (
          <EmptySpaceFiller type="response" environmentId={environmentId} />
        ) : (
          <div>
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
        )}
        {confetti && <Confetti />}
        <ToasterClient />
      </div>
    </>
  );
}
