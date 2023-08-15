import { TResponseData } from "@formbricks/types/v1/responses";
import type { TSurveyNPSQuestion } from "@formbricks/types/v1/surveys";
import { useState } from "preact/hooks";
import { cn } from "../lib/utils";
import { BackButton } from "./BackButton";
import Headline from "./Headline";
import Subheader from "./Subheader";
import SubmitButton from "./SubmitButton";

interface NPSQuestionProps {
  question: TSurveyNPSQuestion;
  onSubmit: (data: TResponseData) => void;
  onBack: (responseData: TResponseData) => void;
  isFirstQuestion: boolean;
  isLastQuestion: boolean;
  brandColor: string;
}

export default function NPSQuestion({
  question,
  onSubmit,
  onBack,
  isFirstQuestion,
  isLastQuestion,
  brandColor,
}: NPSQuestionProps) {
  const [selectedChoice, setSelectedChoice] = useState<number | null>(null);

  const handleSubmit = (value: number | null) => {
    if (value === null) {
      throw new Error("No value selected");
    }
    const data = {
      [question.id]: value,
    };
    setSelectedChoice(null);
    onSubmit(data);
  };

  const handleSelect = (number: number) => {
    setSelectedChoice(number);
    if (question.required) {
      setSelectedChoice(null);
      onSubmit({
        [question.id]: number,
      });
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
                  "relative h-10 flex-1 cursor-pointer border bg-white text-center text-sm leading-10 text-slate-800 first:rounded-l-md last:rounded-r-md hover:bg-gray-100 focus:outline-none"
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
        {!isFirstQuestion && selectedChoice && (
          <BackButton
            onClick={() => {
              onBack({
                [question.id]: selectedChoice,
              });
            }}
          />
        )}
        <div></div>
        {!question.required && (
          <SubmitButton
            question={question}
            isLastQuestion={isLastQuestion}
            brandColor={brandColor}
            onClick={() => {}}
          />
        )}
      </div>
    </form>
  );
}
