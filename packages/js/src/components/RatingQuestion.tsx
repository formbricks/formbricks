import { h } from "preact";
import { useState } from "preact/hooks";
import { cn } from "../lib/utils";
import type { RatingQuestion } from "@formbricks/types/questions";
import Headline from "./Headline";
import Subheader from "./Subheader";

interface RatingQuestionProps {
  question: RatingQuestion;
  onSubmit: (data: { [x: string]: any }) => void;
  lastQuestion: boolean;
  brandColor: string;
}

export default function RatingQuestion({
  question,
  onSubmit,
  lastQuestion,
  brandColor,
}: RatingQuestionProps) {
  const [selectedChoice, setSelectedChoice] = useState<number | null>(null);

  const handleSelect = (number: number) => {
    setSelectedChoice(number);
    if (question.required) {
      onSubmit({
        [question.id]: number,
      });
      setSelectedChoice(null); // reset choice
    }
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();

        const data = {
          [question.id]: selectedChoice,
        };

        setSelectedChoice(null); // reset choice

        onSubmit(data);
      }}>
      <Headline headline={question.headline} questionId={question.id} />
      <Subheader subheader={question.subheader} questionId={question.id} />
      <div className="fb-my-4">
        <fieldset>
          <legend className="fb-sr-only">Choices</legend>
          <div className="fb-flex">
            {Array.from({ length: question.range }, (_, i) => i + 1).map((number) => (
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
          <div className="fb-flex fb-justify-between fb-text-slate-500  fb-leading-6 fb-px-1.5 fb-text-xs">
            <p>{question.lowerLabel}</p>
            <p>{question.upperLabel}</p>
          </div>
        </fieldset>
      </div>
      {!question.required && (
        <div className="fb-mt-4 fb-flex fb-w-full fb-justify-between">
          <div></div>
          <button
            type="submit"
            className="fb-flex fb-items-center fb-rounded-md fb-border fb-border-transparent fb-px-3 fb-py-3 fb-text-base fb-font-medium fb-leading-4 fb-text-white fb-shadow-sm hover:fb-opacity-90 focus:fb-outline-none focus:fb-ring-2 focus:fb-ring-slate-500 focus:fb-ring-offset-2"
            style={{ backgroundColor: brandColor }}>
            {question.buttonLabel || (lastQuestion ? "Finish" : "Next")}
          </button>
        </div>
      )}
    </form>
  );
}
