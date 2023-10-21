import { TResponseData } from "@formbricks/types/v1/responses";
import type { TSurveyCTAQuestion } from "@formbricks/types/v1/surveys";
import { BackButton } from "./BackButton";
import Headline from "./Headline";
import HtmlBody from "./HtmlBody";
import SubmitButton from "./SubmitButton";
import { useRef, useEffect } from "preact/hooks";

interface CTAQuestionProps {
  question: TSurveyCTAQuestion;
  value: string | number | string[];
  onChange: (responseData: TResponseData) => void;
  onSubmit: (data: TResponseData, isSubmit: boolean, time: any) => void;
  onBack: () => void;
  isFirstQuestion: boolean;
  isLastQuestion: boolean;
  brandColor: string;
}

export default function CTAQuestion({
  question,
  onSubmit,
  onBack,
  isFirstQuestion,
  isLastQuestion,
  brandColor,
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
              className="mr-4 flex items-center rounded-md px-3 py-3 text-base font-medium leading-4 hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2 dark:text-slate-400">
              {question.dismissButtonLabel || "Skip"}
            </button>
          )}
          <SubmitButton
            buttonLabel={question.buttonLabel}
            isLastQuestion={isLastQuestion}
            brandColor={brandColor}
            focus={true}
            onClick={() => {
              if (question.buttonExternal && question.buttonUrl) {
                window?.open(question.buttonUrl, "_blank")?.focus();
              }
              console.log({ startTime });
              onSubmit({ [question.id]: "clicked" }, true, performance.now() - startTime.current);
            }}
            type="button"
          />
        </div>
      </div>
    </div>
  );
}
