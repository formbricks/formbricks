import { h } from "preact";
import { TResponseData } from "../../../types/v1/responses";
import type { TSurveyConsentQuestion } from "../../../types/v1/surveys";
import Headline from "./Headline";
import HtmlBody from "./HtmlBody";
import SubmitButton from "./SubmitButton";
import { useEffect, useState } from "preact/hooks";
import { BackButton } from "./BackButton";

interface ConsentQuestionProps {
  question: TSurveyConsentQuestion;
  onSubmit: (data: TResponseData) => void;
  lastQuestion: boolean;
  brandColor: string;
  savedAnswer: string | null;
  goToNextQuestion: (answer: TResponseData) => void;
  goToPreviousQuestion?: (answer?: TResponseData) => void;
}

export default function ConsentQuestion({
  question,
  onSubmit,
  lastQuestion,
  brandColor,
  savedAnswer,
  goToNextQuestion,
  goToPreviousQuestion,
}: ConsentQuestionProps) {
  const [answer, setAnswer] = useState<string>("dismissed");

  useEffect(() => {
    setAnswer(savedAnswer ?? "dismissed");
  }, [savedAnswer, question]);

  const handleOnChange = () => {
    answer === "accepted" ? setAnswer("dissmissed") : setAnswer("accepted");
  };

  const handleSumbit = (value: string) => {
    const data = {
      [question.id]: value,
    };
    if (savedAnswer === value) {
      goToNextQuestion(data);
      setAnswer("dismissed");

      return;
    }
    onSubmit(data);
    setAnswer("dismissed");
  };
  return (
    <div>
      <Headline headline={question.headline} questionId={question.id} />
      <HtmlBody htmlString={question.html || ""} questionId={question.id} />

      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSumbit(answer);
        }}>
        <label className="fb-relative fb-z-10 fb-mt-4 fb-flex fb-w-full fb-cursor-pointer fb-items-center fb-rounded-md fb-border fb-border-gray-200 fb-bg-slate-50 fb-p-4 fb-text-sm focus:fb-outline-none">
          <input
            type="checkbox"
            id={question.id}
            name={question.id}
            value={question.label}
            onChange={handleOnChange}
            checked={answer === "accepted"}
            className="fb-h-4 fb-w-4 fb-border fb-border-slate-300 focus:fb-ring-0 focus:fb-ring-offset-0"
            aria-labelledby={`${question.id}-label`}
            style={{ borderColor: brandColor, color: brandColor }}
            required={question.required}
          />
          <span id={`${question.id}-label`} className="fb-ml-3 fb-font-medium">
            {question.label}
          </span>
        </label>

        <div className="fb-mt-4 fb-flex fb-w-full fb-justify-between">
          {goToPreviousQuestion && (
            <BackButton
              onClick={() =>
                goToPreviousQuestion({
                  [question.id]: answer,
                })
              }
            />
          )}
          <div />
          <SubmitButton
            brandColor={brandColor}
            question={question}
            lastQuestion={lastQuestion}
            onClick={() => {}}
          />
        </div>
      </form>
    </div>
  );
}
