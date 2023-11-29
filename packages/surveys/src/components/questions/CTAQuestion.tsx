import { BackButton } from "@/components/buttons/BackButton";
import SubmitButton from "@/components/buttons/SubmitButton";
import QuestionImage from "@/components/general/QuestionImage";
import Headline from "@/components/general/Headline";
import HtmlBody from "@/components/general/HtmlBody";
import { TResponseData } from "@formbricks/types/responses";
import type { TSurveyCTAQuestion } from "@formbricks/types/surveys";
import { useState, useEffect } from "react";
import { TResponseTtc } from "@formbricks/types/responses";
import { getUpdatedTtcObj } from "../../lib/utils";

interface CTAQuestionProps {
  question: TSurveyCTAQuestion;
  value: string | number | string[];
  onChange: (responseData: TResponseData) => void;
  onSubmit: (data: TResponseData, ttc: TResponseTtc) => void;
  onBack: () => void;
  isFirstQuestion: boolean;
  isLastQuestion: boolean;
  ttcObj: TResponseTtc;
  setTtcObj: (ttc: TResponseTtc) => void;
}

export default function CTAQuestion({
  question,
  onSubmit,
  onBack,
  isFirstQuestion,
  isLastQuestion,
  ttcObj,
  setTtcObj,
}: CTAQuestionProps) {
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
      <HtmlBody htmlString={question.html} questionId={question.id} />

      <div className="mt-4 flex w-full justify-between">
        {!isFirstQuestion && (
          <BackButton
            backButtonLabel={question.backButtonLabel}
            onClick={() => {
              const updatedTtcObj = getUpdatedTtcObj(ttcObj, question.id, performance.now() - startTime);
              setTtcObj(updatedTtcObj);
              onSubmit({ [question.id]: "" }, updatedTtcObj);
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
                const updatedTtcObj = getUpdatedTtcObj(ttcObj, question.id, performance.now() - startTime);
                setTtcObj(updatedTtcObj);
                onSubmit({ [question.id]: "dismissed" }, updatedTtcObj);
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
              const updatedTtcObj = getUpdatedTtcObj(ttcObj, question.id, performance.now() - startTime);
              setTtcObj(updatedTtcObj);
              onSubmit({ [question.id]: "clicked" }, updatedTtcObj);
            }}
            type="button"
          />
        </div>
      </div>
    </div>
  );
}
