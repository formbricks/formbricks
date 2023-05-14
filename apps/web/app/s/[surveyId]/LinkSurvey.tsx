"use client";

import Progress from "@/components/preview/Progress";
import QuestionConditional from "@/components/preview/QuestionConditional";
import ThankYouCard from "@/components/preview/ThankYouCard";
import ContentWrapper from "@/components/shared/ContentWrapper";
import LoadingSpinner from "@/components/shared/LoadingSpinner";
import { createDisplay, markDisplayResponded } from "@formbricks/lib/clientDisplay/display";
import { createResponse, updateResponse } from "@formbricks/lib/clientResponse/response";
import { cn } from "@formbricks/lib/cn";
import type { Question } from "@formbricks/types/questions";
import type { Survey } from "@formbricks/types/surveys";
import { Confetti } from "@formbricks/ui";
import { useEffect, useState } from "react";

type EnhancedSurvey = Survey & {
  brandColor: string;
};

interface LinkSurveyProps {
  survey: EnhancedSurvey;
}

export default function LinkSurvey({ survey }: LinkSurveyProps) {
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [progress, setProgress] = useState(0); // [0, 1]
  const [finished, setFinished] = useState(false);
  const [loadingElement, setLoadingElement] = useState(false);
  const [responseId, setResponseId] = useState<string | null>(null);
  const [displayId, setDisplayId] = useState<string | null>(null);

  useEffect(() => {
    if (survey) {
      setCurrentQuestion(survey.questions[0]);
      // create display
      createDisplay(
        { surveyId: survey.id },
        `${window.location.protocol}//${window.location.host}`,
        survey.environmentId
      ).then((display) => {
        setDisplayId(display.id);
      });
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
      const response = await createResponse(
        responseRequest,
        `${window.location.protocol}//${window.location.host}`,
        survey.environmentId
      );
      if (displayId) {
        markDisplayResponded(
          displayId,
          `${window.location.protocol}//${window.location.host}`,
          survey.environmentId
        );
      }
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
      setProgress(1);
      setFinished(true);
    }
  };

  if (!currentQuestion) {
    return (
      <div className="flex h-full flex-1 items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  const lastQuestion = currentQuestion.id === survey.questions[survey.questions.length - 1].id;

  return (
    <>
      <div
        className={cn(
          loadingElement && "fb-animate-pulse fb-opacity-60",
          "flex h-full flex-1 items-center overflow-y-auto bg-white"
        )}>
        <ContentWrapper className="w-full md:max-w-lg">
          {finished ? (
            <div>
              <Confetti colors={[survey.brandColor, "#eee"]} />
              <ThankYouCard
                headline={survey.thankYouCard.headline || "Thank you!"}
                subheader={survey.thankYouCard.subheader || "Your response has been recorded."}
                brandColor={survey.brandColor}
              />
            </div>
          ) : (
            <QuestionConditional
              question={currentQuestion}
              brandColor={survey.brandColor}
              lastQuestion={lastQuestion}
              onSubmit={submitResponse}
            />
          )}
        </ContentWrapper>
      </div>
      <div className="top-0 z-10 w-full border-b bg-white">
        <div className="mx-auto max-w-md p-6">
          <Progress progress={progress} brandColor={survey.brandColor} />
        </div>
      </div>
    </>
  );
}
