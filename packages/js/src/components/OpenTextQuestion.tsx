import { h } from "preact";
import { TResponseData } from "../../../types/v1/responses";
import type { TSurveyOpenTextQuestion } from "../../../types/v1/surveys";
import Headline from "./Headline";
import Subheader from "./Subheader";
import SubmitButton from "./SubmitButton";
import { useEffect, useState } from "preact/hooks";
import { BackButton } from "./BackButton";

interface OpenTextQuestionProps {
  question: TSurveyOpenTextQuestion;
  onSubmit: (data: TResponseData) => void;
  lastQuestion: boolean;
  brandColor: string;
  storedResponseValue: string | null;
  goToNextQuestion: (answer: TResponseData) => void;
  goToPreviousQuestion?: (answer: TResponseData) => void;
}

export default function OpenTextQuestion({
  question,
  onSubmit,
  lastQuestion,
  brandColor,
  storedResponseValue,
  goToNextQuestion,
  goToPreviousQuestion,
}: OpenTextQuestionProps) {
  const [value, setValue] = useState<string>("");

  useEffect(() => {
    setValue(storedResponseValue ?? "");
  }, [storedResponseValue, question.id]);

  const handleSubmit = (value: string) => {
    const data = {
      [question.id]: value,
    };
    if (storedResponseValue === value) {
      goToNextQuestion(data);
      return;
    }
    onSubmit(data);
    setValue(""); // reset value
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        handleSubmit(value);
      }}>
      <Headline headline={question.headline} questionId={question.id} />
      <Subheader subheader={question.subheader} questionId={question.id} />
      <div className="fb-mt-4">
        {question.longAnswer === false ? (
          <input
            name={question.id}
            id={question.id}
            placeholder={!storedResponseValue ? question.placeholder : undefined}
            required={question.required}
            value={value}
            onInput={(e) => setValue(e.currentTarget.value)}
            className="fb-block fb-w-full fb-rounded-md fb-border fb-p-2 fb-shadow-sm focus:fb-ring-0 sm:fb-text-sm fb-bg-slate-50 fb-border-slate-100 focus:fb-border-slate-500 focus:fb-outline-none"
          />
        ) : (
          <textarea
            rows={3}
            name={question.id}
            id={question.id}
            placeholder={!storedResponseValue ? question.placeholder : undefined}
            required={question.required}
            value={value}
            onInput={(e) => setValue(e.currentTarget.value)}
            className="fb-block fb-w-full fb-rounded-md fb-border fb-p-2 fb-shadow-sm focus:fb-ring-0 sm:fb-text-sm fb-bg-slate-50 fb-border-slate-100 focus:fb-border-slate-500"></textarea>
        )}
      </div>
      <div className="fb-mt-4 fb-flex fb-w-full fb-justify-between">
        {goToPreviousQuestion && (
          <BackButton
            backButtonLabel={question.backButtonLabel}
            onClick={() => {
              goToPreviousQuestion({
                [question.id]: value,
              });
            }}
          />
        )}
        <div></div>
        <SubmitButton
          question={question}
          lastQuestion={lastQuestion}
          brandColor={brandColor}
          onClick={() => {}}
        />
      </div>
    </form>
  );
}
