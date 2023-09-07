import { useEffect, useState } from "react";
import { cn } from "@formbricks/lib/cn";
import type { NPSQuestion } from "@formbricks/types/questions";
import Headline from "./Headline";
import Subheader from "./Subheader";
import SubmitButton from "@/components/preview/SubmitButton";
import { Response } from "@formbricks/types/js";
import { BackButton } from "@/components/preview/BackButton";
import { TSurveyNPSQuestion } from "@formbricks/types/v1/surveys";

interface NPSQuestionProps {
  question: NPSQuestion | TSurveyNPSQuestion;
  onSubmit: (data: { [x: string]: any }) => void;
  lastQuestion: boolean;
  brandColor: string;
  storedResponseValue: number | null;
  goToNextQuestion: (answer: Response["data"]) => void;
  goToPreviousQuestion?: (answer?: Response["data"]) => void;
}

export default function NPSQuestion({
  question,
  onSubmit,
  lastQuestion,
  brandColor,
  storedResponseValue,
  goToNextQuestion,
  goToPreviousQuestion,
}: NPSQuestionProps) {
  const [selectedChoice, setSelectedChoice] = useState<number | null>(null);

  useEffect(() => {
    setSelectedChoice(storedResponseValue);
  }, [storedResponseValue, question]);

  const handleSubmit = (value: number | null) => {
    const data = {
      [question.id]: value ?? null,
    };
    if (storedResponseValue === value) {
      setSelectedChoice(null);
      goToNextQuestion(data);
      return;
    }
    setSelectedChoice(null);
    onSubmit(data);
  };

  const handleSelect = (number: number) => {
    setSelectedChoice(number);
    if (question.required) {
      handleSubmit(number);
    }
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        handleSubmit(selectedChoice);
      }}>
      <Headline headline={question.headline} questionId={question.id} />
      <Subheader subheader={question.subheader} questionId={question.id} />
      <div className="my-4">
        <fieldset>
          <legend className="sr-only">Options</legend>
          <div className="flex">
            {Array.from({ length: 11 }, (_, i) => i).map((number) => (
              <label
                key={number}
                className={cn(
                  selectedChoice === number ? "z-10 border-slate-400 bg-slate-50" : "",
                  "relative h-10 flex-1 cursor-pointer border bg-white text-center text-sm  leading-10 first:rounded-l-md last:rounded-r-md hover:bg-gray-100 focus:outline-none"
                )}>
                <input
                  type="radio"
                  name="nps"
                  value={number}
                  checked={selectedChoice === number}
                  className="absolute h-full w-full cursor-pointer opacity-0"
                  onClick={() => handleSelect(number)}
                  required={question.required}
                />
                {number}
              </label>
            ))}
          </div>
          <div className="flex justify-between px-1.5 text-xs leading-6 text-slate-500">
            <p>{question.lowerLabel}</p>
            <p>{question.upperLabel}</p>
          </div>
        </fieldset>
      </div>
      <div className="mt-4 flex w-full justify-between">
        {goToPreviousQuestion && (
          <BackButton
            backButtonLabel={question.backButtonLabel}
            onClick={() => {
              goToPreviousQuestion(
                storedResponseValue !== selectedChoice
                  ? {
                      [question.id]: selectedChoice,
                    }
                  : undefined
              );
            }}
          />
        )}
        <div></div>
        {(!question.required || storedResponseValue) && (
          <SubmitButton {...{ question, lastQuestion, brandColor }} />
        )}
      </div>
    </form>
  );
}
