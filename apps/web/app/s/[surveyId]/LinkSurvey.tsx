"use client";

import FormbricksSignature from "@/components/preview/FormbricksSignature";
import Progress from "@/components/preview/Progress";
import QuestionConditional from "@/components/preview/QuestionConditional";
import ThankYouCard from "@/components/preview/ThankYouCard";
import ContentWrapper from "@/components/shared/ContentWrapper";
import LoadingSpinner from "@/components/shared/LoadingSpinner";
import { useLinkSurveyUtils } from "@/lib/linkSurvey/linkSurvey";
import { cn } from "@formbricks/lib/cn";
import { Confetti } from "@formbricks/ui";
import { ArrowPathIcon } from "@heroicons/react/24/solid";
import type { Survey } from "@formbricks/types/surveys";

type EnhancedSurvey = Survey & {
  brandColor: string;
  formbricksSignature: boolean;
};

interface LinkSurveyProps {
  survey: EnhancedSurvey;
}

export default function LinkSurvey({ survey }: LinkSurveyProps) {
  const {
    currentQuestion,
    finished,
    loadingElement,
    prefilling,
    progress,
    isPreview,
    lastQuestion,
    initiateCountdown,
    restartSurvey,
    submitResponse,
  } = useLinkSurveyUtils(survey);

  if (!currentQuestion || prefilling) {
    return (
      <div className="flex h-full flex-1 items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <>
      <div
        className={cn(
          loadingElement && "animate-pulse opacity-60",
          "flex h-full flex-1 items-center overflow-y-auto bg-white"
        )}>
        <ContentWrapper className="w-full md:max-w-lg">
          {isPreview && (
            <div className="absolute left-0 top-0 flex w-full items-center justify-between bg-slate-600 p-2 px-4 text-center text-sm text-white shadow-sm">
              <div className="w-20"></div>
              <div className="">Survey Preview 👀</div>
              <button
                className="flex items-center rounded-full bg-slate-500 px-3 py-1 hover:bg-slate-400"
                onClick={() => restartSurvey()}>
                Restart <ArrowPathIcon className="ml-2 h-4 w-4" />
              </button>
            </div>
          )}
          {finished ? (
            <div>
              <Confetti colors={[survey.brandColor, "#eee"]} />
              <ThankYouCard
                headline={survey.thankYouCard.headline || "Thank you!"}
                subheader={survey.thankYouCard.subheader || "Your response has been recorded."}
                brandColor={survey.brandColor}
                initiateCountdown={initiateCountdown}
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
        <div className="mx-auto max-w-md space-y-6 p-6">
          <Progress progress={progress} brandColor={survey.brandColor} />
          {survey.formbricksSignature && <FormbricksSignature />}
        </div>
      </div>
    </>
  );
}
