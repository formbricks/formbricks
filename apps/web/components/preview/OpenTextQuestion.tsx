import type { OpenTextQuestion } from "@formbricks/types/questions";
import { useEffect, useState } from "react";
import Headline from "./Headline";
import Subheader from "./Subheader";
import SubmitButton from "@/components/preview/SubmitButton";
import { Response } from "@formbricks/types/js";
import { BackButton } from "@/components/preview/BackButton";
import { TSurveyOpenTextQuestion } from "@formbricks/types/v1/surveys";

interface OpenTextQuestionProps {
  question: TSurveyOpenTextQuestion;
  onSubmit: (data: { [x: string]: any }) => void;
  lastQuestion: boolean;
  brandColor: string;
  storedResponseValue: string | null;
  goToNextQuestion: (answer: Response["data"]) => void;
  goToPreviousQuestion?: (answer: Response["data"]) => void;
  autoFocus?: boolean;
}

export default function OpenTextQuestion({
  question,
  onSubmit,
  lastQuestion,
  brandColor,
  storedResponseValue,
  goToNextQuestion,
  goToPreviousQuestion,
  autoFocus = false,
}: OpenTextQuestionProps) {
  const [value, setValue] = useState<string>("");

  useEffect(() => {
    setValue(storedResponseValue ?? "");
  }, [storedResponseValue, question.id, question.longAnswer]);

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
      <div className="mt-4">
        {question.longAnswer === false ? (
          <input
            autoFocus={autoFocus && !storedResponseValue}
            name={question.id}
            id={question.id}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={!storedResponseValue ? question.placeholder : undefined}
            required={question.required}
            className="block w-full rounded-md border border-slate-100 bg-slate-50 p-2 shadow-sm focus:border-slate-500 focus:outline-none focus:ring-0 sm:text-sm"
          />
        ) : (
          <textarea
            autoFocus={autoFocus && !storedResponseValue}
            rows={3}
            name={question.id}
            id={question.id}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={!storedResponseValue ? question.placeholder : undefined}
            required={question.required}
            className="block w-full rounded-md border border-slate-100 bg-slate-50 p-2 shadow-sm focus:border-slate-500 focus:ring-0 sm:text-sm"
          />
        )}
      </div>
      <div className="mt-4 flex w-full justify-between">
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
        <SubmitButton {...{ question, lastQuestion, brandColor, storedResponseValue, goToNextQuestion }} />
      </div>
    </form>
  );
}
