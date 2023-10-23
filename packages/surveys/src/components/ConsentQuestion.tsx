import { TResponseData } from "@formbricks/types/responses";
import type { TSurveyConsentQuestion } from "@formbricks/types/surveys";
import { BackButton } from "./BackButton";
import Headline from "./Headline";
import HtmlBody from "./HtmlBody";
import SubmitButton from "./SubmitButton";
import { useRef, useEffect } from "react";

interface ConsentQuestionProps {
  question: TSurveyConsentQuestion;
  value: string | number | string[];
  onChange: (responseData: TResponseData) => void;
  onSubmit: (data: TResponseData, isSubmit: boolean, time: any) => void;
  onBack: () => void;
  isFirstQuestion: boolean;
  isLastQuestion: boolean;
  brandColor: string;
}

export default function ConsentQuestion({
  question,
  value,
  onChange,
  onSubmit,
  onBack,
  isFirstQuestion,
  isLastQuestion,
  brandColor,
}: ConsentQuestionProps) {
  const startTime = useRef<number>(performance.now());

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        // Restart the timer when the tab becomes visible again
        startTime.current = performance.now();
      } else {
        onSubmit({ [question.id]: value }, false, performance.now() - startTime.current);
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
      <HtmlBody htmlString={question.html || ""} questionId={question.id} />

      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit({ [question.id]: value }, true, performance.now() - startTime.current);
        }}>
        <label
          tabIndex={1}
          onKeyDown={(e) => {
            if (e.key == "Enter") {
              onChange({ [question.id]: "accepted" });
            }
          }}
          className="relative z-10 mt-4 flex w-full cursor-pointer items-center rounded-md border border-gray-200 p-4 text-sm text-slate-800 hover:bg-slate-50 focus:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2">
          <input
            type="checkbox"
            id={question.id}
            name={question.id}
            value={question.label}
            onChange={(e) => {
              if (e.target instanceof HTMLInputElement && e.target.checked) {
                onChange({ [question.id]: "accepted" });
              } else {
                onChange({ [question.id]: "dismissed" });
              }
            }}
            checked={value === "accepted"}
            className="h-4 w-4 border border-slate-300 focus:ring-0 focus:ring-offset-0"
            aria-labelledby={`${question.id}-label`}
            style={{ borderColor: brandColor, color: brandColor }}
            required={question.required}
          />
          <span id={`${question.id}-label`} className="ml-3 font-medium">
            {question.label}
          </span>
        </label>

        <div className="mt-4 flex w-full justify-between">
          {!isFirstQuestion && (
            <BackButton
              tabIndex={3}
              backButtonLabel={question.backButtonLabel}
              onClick={() => {
                onSubmit({ [question.id]: value }, false, performance.now() - startTime.current);
                onBack();
              }}
            />
          )}
          <div />
          <SubmitButton
            tabIndex={2}
            brandColor={brandColor}
            buttonLabel={question.buttonLabel}
            isLastQuestion={isLastQuestion}
            onClick={() => {}}
          />
        </div>
      </form>
    </div>
  );
}
