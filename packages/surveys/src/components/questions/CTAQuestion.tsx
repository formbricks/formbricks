import { BackButton } from "@/components/buttons/BackButton";
import SubmitButton from "@/components/buttons/SubmitButton";
import Headline from "@/components/general/Headline";
import HtmlBody from "@/components/general/HtmlBody";
import { TResponseData } from "@formbricks/types/responses";
import type { TSurveyCTAQuestion } from "@formbricks/types/surveys";
import { useRef, useEffect } from "react";

interface CTAQuestionProps {
  question: TSurveyCTAQuestion;
  value: string | number | string[];
  onChange: (responseData: TResponseData) => void;
  onSubmit: (data: TResponseData, isSubmit: boolean, time: number) => void;
  onBack: () => void;
  isFirstQuestion: boolean;
  isLastQuestion: boolean;
}

export default function CTAQuestion({
  question,
  onSubmit,
  onBack,
  isFirstQuestion,
  isLastQuestion,
}: CTAQuestionProps) {
  const startTime = useRef<number>(performance.now());

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        // Restart the timer when the tab becomes visible again
        startTime.current = performance.now();
      } else {
        onSubmit({ [question.id]: "" }, false, performance.now() - startTime.current);
      }
    };

    // Attach the event listener
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      // Clean up the event listener when the component is unmounted
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  return (
    <div>
      {question.imageUrl && (
        <div className="my-4 rounded-md">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={question.imageUrl} alt="question-image" className={"my-4 rounded-md"} />
        </div>
      )}
      <Headline headline={question.headline} questionId={question.id} required={question.required} />
      <HtmlBody htmlString={question.html} questionId={question.id} />

      <div className="mt-4 flex w-full justify-between">
        {!isFirstQuestion && (
          <BackButton
            backButtonLabel={question.backButtonLabel}
            onClick={() => {
              onSubmit({ [question.id]: "" }, false, performance.now() - startTime.current);
              onBack();
            }}
          />
        )}
        <div className="flex w-full justify-end">
          {!question.required && (
            <button
              tabIndex={0}
              type="button"
              onClick={() => {
                onSubmit({ [question.id]: "dismissed" }, true, performance.now() - startTime.current);
              }}
              className="text-heading focus:ring-focus mr-4 flex items-center rounded-md px-3 py-3 text-base font-medium leading-4 hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2">
              {question.dismissButtonLabel || "Skip"}
            </button>
          )}
          <SubmitButton
            buttonLabel={question.buttonLabel}
            isLastQuestion={isLastQuestion}
            focus={true}
            onClick={() => {
              if (question.buttonExternal && question.buttonUrl) {
                window?.open(question.buttonUrl, "_blank")?.focus();
              }
              onSubmit({ [question.id]: "clicked" }, true, performance.now() - startTime.current);
            }}
            type="button"
          />
        </div>
      </div>
    </div>
  );
}
