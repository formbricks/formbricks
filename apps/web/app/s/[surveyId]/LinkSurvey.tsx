"use client";

import MultipleChoiceSingleQuestion from "@/components/preview/MultipleChoiceSingleQuestion";
import OpenTextQuestion from "@/components/preview/OpenTextQuestion";
import Progress from "@/components/preview/Progress";
import ContentWrapper from "@/components/shared/ContentWrapper";
import LoadingSpinner from "@/components/shared/LoadingSpinner";
import { Confetti } from "@formbricks/ui";
import { createResponse, updateResponse } from "@formbricks/lib/clientResponse/response";
import { useLinkSurvey } from "@/lib/linkSurvey/linkSurvey";
import { cn } from "@formbricks/lib/cn";
import type { Question } from "@formbricks/types/questions";
import { useEffect, useState } from "react";

interface LinkSurveyProps {
  surveyId: string;
}

export default function LinkSurvey({ surveyId }: LinkSurveyProps) {
  const { survey, isLoadingSurvey, isErrorSurvey } = useLinkSurvey(surveyId);
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [progress, setProgress] = useState(0); // [0, 1]
  const [finished, setFinished] = useState(false);
  const [loadingElement, setLoadingElement] = useState(false);
  const [responseId, setResponseId] = useState<string | null>(null);

  useEffect(() => {
    if (survey) {
      setCurrentQuestion(survey.questions[0]);
    }
  }, [survey]);

  useEffect(() => {
    if (currentQuestion && survey) {
      setProgress(calculateProgress(currentQuestion, survey));
    }

    function calculateProgress(currentQuestion, survey) {
      const elementIdx = survey.questions.findIndex((e) => e.id === currentQuestion.id);
      return elementIdx / survey.questions.length;
    }
  }, [currentQuestion, survey]);

  const submitResponse = async (data: { [x: string]: any }) => {
    setLoadingElement(true);
    const questionIdx = survey.questions.findIndex((e) => e.id === currentQuestion?.id);
    const finished = questionIdx === survey.questions.length - 1;
    // build response
    const responseRequest = {
      surveyId: survey.id,
      response: { finished, data },
    };
    if (!responseId) {
      /* const [response] = await Promise.all([
        createResponse(
          responseRequest,
          `${window.location.protocol}//${window.location.host}`,
          survey.environmentId
        ),
        markDisplayResponded(displayId, config),
      ]); */
      const response = await createResponse(
        responseRequest,
        `${window.location.protocol}//${window.location.host}`,
        survey.environmentId
      );
      setResponseId(response.id);
    } else {
      await updateResponse(
        responseRequest,
        responseId,
        `${window.location.protocol}//${window.location.host}`,
        survey.environmentId
      );
    }
    setLoadingElement(false);
    if (!finished) {
      setCurrentQuestion(survey.questions[questionIdx + 1]);
    } else {
      setProgress(100);
      setFinished(true);
    }
  };

  if (isLoadingSurvey || !currentQuestion) {
    return (
      <div className="flex h-full flex-1 items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  if (isErrorSurvey) {
    return <div>Survey cannot be found</div>;
  }

  const lastQuestion = currentQuestion.id === survey.questions[survey.questions.length - 1].id;

  return (
    <>
      <div
        className={cn(
          loadingElement && "fb-animate-pulse fb-opacity-60",
          "flex h-full flex-1 items-center overflow-y-auto"
        )}>
        <ContentWrapper>
          {finished ? (
            <div>
              <Confetti />
              <h1 className="text-2xl font-bold">Thank you for your time!</h1>
              <p className="mt-4">You have completed the survey.</p>
            </div>
          ) : currentQuestion.type === "openText" ? (
            <OpenTextQuestion
              question={currentQuestion}
              onSubmit={submitResponse}
              lastQuestion={lastQuestion}
              brandColor={survey.brandColor}
            />
          ) : currentQuestion.type === "multipleChoiceSingle" ? (
            <MultipleChoiceSingleQuestion
              question={currentQuestion}
              onSubmit={submitResponse}
              lastQuestion={lastQuestion}
              brandColor={survey.brandColor}
            />
          ) : null}
        </ContentWrapper>
      </div>
      <div className="top-0 z-10 w-full border-b">
        <div className="mx-auto max-w-lg p-6">
          <Progress progress={progress} brandColor={survey.brandColor} />
        </div>
      </div>
    </>
  );
}
