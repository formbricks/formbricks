import { BackButton } from "@/components/buttons/BackButton";
import SubmitButton from "@/components/buttons/SubmitButton";
import Headline from "@/components/general/Headline";
import HtmlBody from "@/components/general/HtmlBody";
import QuestionImage from "@/components/general/QuestionImage";
import { TResponseData, TResponseTtc } from "@formbricks/types/responses";
import type { TSurveyConsentQuestion } from "@formbricks/types/surveys";
import { useEffect, useState } from "preact/hooks";
import { getUpdatedTtcObj } from "../../lib/utils";

interface ConsentQuestionProps {
  question: TSurveyConsentQuestion;
  value: string | number | string[];
  onChange: (responseData: TResponseData) => void;
  onSubmit: (data: TResponseData, ttc: TResponseTtc) => void;
  onBack: () => void;
  isFirstQuestion: boolean;
  isLastQuestion: boolean;
  ttcObj: TResponseTtc;
  setTtcObj: (ttc: TResponseTtc) => void;
}

export default function ConsentQuestion({
  question,
  value,
  onChange,
  onSubmit,
  onBack,
  isFirstQuestion,
  isLastQuestion,
  ttcObj,
  setTtcObj,
}: ConsentQuestionProps) {
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
    <div>
      {question.imageUrl && <QuestionImage imgUrl={question.imageUrl} />}
      <Headline headline={question.headline} questionId={question.id} required={question.required} />
      <HtmlBody htmlString={question.html || ""} questionId={question.id} />

      <form
        onSubmit={(e) => {
          e.preventDefault();
          const updatedTtcObj = getUpdatedTtcObj(ttcObj, question.id, performance.now() - startTime);
          setTtcObj(updatedTtcObj);
          onSubmit({ [question.id]: value }, updatedTtcObj);
        }}>
        <label
          tabIndex={1}
          onKeyDown={(e) => {
            if (e.key == "Enter") {
              onChange({ [question.id]: "accepted" });
            }
          }}
          className="border-border bg-survey-bg text-heading hover:bg-accent-bg focus:bg-accent-bg focus:ring-border-highlight relative z-10 mt-4 flex w-full cursor-pointer items-center rounded-md border p-4 text-sm focus:outline-none focus:ring-2 focus:ring-offset-2">
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
            className="border-brand text-brand h-4 w-4 border focus:ring-0 focus:ring-offset-0"
            aria-labelledby={`${question.id}-label`}
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
                const updatedTtcObj = getUpdatedTtcObj(ttcObj, question.id, performance.now() - startTime);
                setTtcObj(updatedTtcObj);
                onSubmit({ [question.id]: value }, updatedTtcObj);
                onBack();
              }}
            />
          )}
          <div />
          <SubmitButton
            tabIndex={2}
            buttonLabel={question.buttonLabel}
            isLastQuestion={isLastQuestion}
            onClick={() => {}}
          />
        </div>
      </form>
    </div>
  );
}
