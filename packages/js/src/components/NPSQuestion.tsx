import { h } from "preact";
import { useState } from "preact/hooks";
import { TResponseData } from "../../../types/v1/responses";
import type { TSurveyNPSQuestion } from "../../../types/v1/surveys";
import { cn } from "../lib/utils";
import Headline from "./Headline";
import Subheader from "./Subheader";
import SubmitButton from "./SubmitButton";

interface NPSQuestionProps {
  question: TSurveyNPSQuestion;
  onSubmit: (data: TResponseData) => void;
  lastQuestion: boolean;
  brandColor: string;
}

export default function NPSQuestion({ question, onSubmit, lastQuestion, brandColor }: NPSQuestionProps) {
  const [selectedChoice, setSelectedChoice] = useState<number | null>(null);

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

        const data = {};
        if (selectedChoice !== null) {
          data[question.id] = selectedChoice;
        }

        setSelectedChoice(null);
        onSubmit(data);
        // reset form
      }}>
      <Headline headline={question.headline} questionId={question.id} />
      <Subheader subheader={question.subheader} questionId={question.id} />
      <div className="fb-my-4">
        <fieldset>
          <legend className="fb-sr-only">Options</legend>
          <div className="fb-flex">
            {Array.from({ length: 11 }, (_, i) => i).map((number) => (
              <label
                key={number}
                className={cn(
                  selectedChoice === number ? "fb-z-10 fb-border-slate-400 fb-bg-slate-50" : "",
                  "fb-relative fb-h-10 fb-flex-1 fb-cursor-pointer fb-border fb-bg-white fb-text-center fb-text-sm fb-leading-10 first:fb-rounded-l-md last:fb-rounded-r-md hover:fb-bg-gray-100 focus:fb-outline-none"
                )}>
                <input
                  type="radio"
                  name="nps"
                  value={number}
                  className="fb-absolute fb-h-full fb-w-full fb-cursor-pointer fb-opacity-0"
                  onChange={() => handleSelect(number)}
                  required={question.required}
                />
                {number}
              </label>
            ))}
          </div>
          <div className="fb-flex fb-justify-between fb-text-slate-500 fb-leading-6 fb-px-1.5 fb-text-xs">
            <p>{question.lowerLabel}</p>
            <p>{question.upperLabel}</p>
          </div>
        </fieldset>
      </div>
      {!question.required && (
        <div className="fb-mt-4 fb-flex fb-w-full fb-justify-between">
          <div></div>
          <SubmitButton
            question={question}
            lastQuestion={lastQuestion}
            brandColor={brandColor}
            onClick={() => {}}
          />
        </div>
      )}
    </form>
  );
}
