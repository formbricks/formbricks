import { BackButton } from "@/components/buttons/BackButton";
import SubmitButton from "@/components/buttons/SubmitButton";
import Headline from "@/components/general/Headline";
import Subheader from "@/components/general/Subheader";
import { cn } from "@/lib/utils";
import { TResponseData } from "@formbricks/types/responses";
import type { TSurveyNPSQuestion } from "@formbricks/types/surveys";
import { useState, useEffect } from "react";
import { TResponseTtc } from "@formbricks/types/responses";
import { getUpdatedTtcObj } from "../../lib/utils";

interface NPSQuestionProps {
  question: TSurveyNPSQuestion;
  value: string | number | string[];
  onChange: (responseData: TResponseData) => void;
  onSubmit: (data: TResponseData, ttc: TResponseTtc) => void;
  onBack: () => void;
  isFirstQuestion: boolean;
  isLastQuestion: boolean;
  ttcObj: TResponseTtc;
  setTtcObj: (ttc: TResponseTtc) => void;
}

export default function NPSQuestion({
  question,
  value,
  onChange,
  onSubmit,
  onBack,
  isFirstQuestion,
  isLastQuestion,
  ttcObj,
  setTtcObj,
}: NPSQuestionProps) {
  const [startTime, setStartTime] = useState(performance.now());

  useEffect(() => {
    setStartTime(performance.now());
  }, [question.id]);
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        // Restart the timer when the tab becomes visible again
        setStartTime(performance.now());
      } else {
        const updatedTtcObj = getUpdatedTtcObj(ttcObj, question.id, performance.now() - startTime);
        setTtcObj(updatedTtcObj);
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
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const updatedTtcObj = getUpdatedTtcObj(ttcObj, question.id, performance.now() - startTime);
        setTtcObj(updatedTtcObj);
        onSubmit({ [question.id]: value }, updatedTtcObj);
      }}>
      {question.imageUrl && (
        <div className="my-4 rounded-md">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={question.imageUrl} alt="question-image" className={"my-4 rounded-md"} />
        </div>
      )}
      <Headline headline={question.headline} questionId={question.id} required={question.required} />
      <Subheader subheader={question.subheader} questionId={question.id} />
      <div className="my-4">
        <fieldset>
          <legend className="sr-only">Options</legend>
          <div className="flex">
            {Array.from({ length: 11 }, (_, i) => i).map((number, idx) => (
              <label
                key={number}
                tabIndex={idx + 1}
                onKeyDown={(e) => {
                  if (e.key == "Enter") {
                    const updatedTtcObj = getUpdatedTtcObj(
                      ttcObj,
                      question.id,
                      performance.now() - startTime
                    );
                    setTtcObj(updatedTtcObj);
                    onSubmit({ [question.id]: number }, updatedTtcObj);
                  }
                }}
                className={cn(
                  value === number ? "border-border-highlight bg-accent-selected-bg z-10" : "border-border",
                  "bg-survey-bg text-heading hover:bg-accent-bg relative h-10 flex-1 cursor-pointer border text-center text-sm leading-10 first:rounded-l-md last:rounded-r-md focus:outline-none"
                )}>
                <input
                  type="radio"
                  name="nps"
                  value={number}
                  checked={value === number}
                  className="absolute h-full w-full cursor-pointer opacity-0"
                  onClick={() => {
                    if (question.required) {
                      const updatedTtcObj = getUpdatedTtcObj(
                        ttcObj,
                        question.id,
                        performance.now() - startTime
                      );
                      setTtcObj(updatedTtcObj);
                      onSubmit(
                        {
                          [question.id]: number,
                        },
                        updatedTtcObj
                      );
                    }
                    onChange({ [question.id]: number });
                  }}
                  required={question.required}
                />
                {number}
              </label>
            ))}
          </div>
          <div className="text-info-text flex justify-between px-1.5 text-xs leading-6">
            <p>{question.lowerLabel}</p>
            <p>{question.upperLabel}</p>
          </div>
        </fieldset>
      </div>

      <div className="mt-4 flex w-full justify-between">
        {!isFirstQuestion && (
          <BackButton
            tabIndex={isLastQuestion ? 12 : 13}
            backButtonLabel={question.backButtonLabel}
            onClick={() => {
              const updatedTtcObj = getUpdatedTtcObj(ttcObj, question.id, performance.now() - startTime);
              setTtcObj(updatedTtcObj);
              onBack();
            }}
          />
        )}
        <div></div>
        {!question.required && (
          <SubmitButton
            tabIndex={12}
            buttonLabel={question.buttonLabel}
            isLastQuestion={isLastQuestion}
            onClick={() => {}}
          />
        )}
      </div>
    </form>
  );
}
