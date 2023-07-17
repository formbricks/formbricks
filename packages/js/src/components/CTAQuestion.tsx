import { h } from "preact";
import { TResponseData } from "../../../types/v1/responses";
import type { TSurveyCTAQuestion } from "../../../types/v1/surveys";
import Headline from "./Headline";
import HtmlBody from "./HtmlBody";
import SubmitButton from "./SubmitButton";
import { BackButton } from "./BackButton";

interface CTAQuestionProps {
  question: TSurveyCTAQuestion;
  onSubmit: (data: TResponseData) => void;
  lastQuestion: boolean;
  brandColor: string;
  savedAnswer: number | null;
  goToNextQuestion: (answer: TResponseData) => void;
  goToPreviousQuestion?: (answer?: TResponseData) => void;
}

export default function CTAQuestion({
  question,
  onSubmit,
  lastQuestion,
  brandColor,
  savedAnswer,
  goToNextQuestion,
  goToPreviousQuestion,
}: CTAQuestionProps) {
  return (
    <div>
      <Headline headline={question.headline} questionId={question.id} />
      <HtmlBody htmlString={question.html} questionId={question.id} />

      <div className="fb-mt-4 fb-flex fb-w-full fb-justify-between">
        {goToPreviousQuestion && <BackButton onClick={() => goToPreviousQuestion()} />}
        <div className="fb-flex fb-justify-end">
          {(!question.required || savedAnswer) && (
            <button
              type="button"
              onClick={() => {
                if (savedAnswer) {
                  goToNextQuestion({ [question.id]: "clicked" });
                  return;
                }
                onSubmit({ [question.id]: "dismissed" });
              }}
              className="fb-flex fb-items-center dark:fb-text-slate-400 fb-rounded-md fb-px-3 fb-py-3 fb-text-base fb-font-medium fb-leading-4 fb-hover:opacity-90 fb-focus:outline-none fb-focus:ring-2 fb-focus:ring-slate-500 fb-focus:ring-offset-2 fb-mr-4">
              {typeof savedAnswer === "string" && savedAnswer === "clicked"
                ? "Next"
                : question.dismissButtonLabel || "Skip"}
            </button>
          )}
          <SubmitButton
            question={question}
            lastQuestion={lastQuestion}
            brandColor={brandColor}
            onClick={() => {
              if (question.buttonExternal && question.buttonUrl) {
                window?.open(question.buttonUrl, "_blank")?.focus();
              }
              onSubmit({ [question.id]: "clicked" });
            }}
            type="button"
          />
        </div>
      </div>
    </div>
  );
}
