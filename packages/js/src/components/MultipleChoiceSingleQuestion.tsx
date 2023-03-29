import { h } from "preact";
import { useState } from "preact/hooks";
import { cn } from "../lib/utils";
import type { MultipleChoiceSingleQuestion } from "@formbricks/types/js";
import Headline from "./Headline";
import Subheader from "./Subheader";

interface MultipleChoiceSingleProps {
  question: MultipleChoiceSingleQuestion;
  onSubmit: (data: { [x: string]: any }) => void;
  lastQuestion: boolean;
  brandColor: string;
}

export default function MultipleChoiceSingleQuestion({
  question,
  onSubmit,
  lastQuestion,
  brandColor,
}: MultipleChoiceSingleProps) {
  const [selectedChoice, setSelectedChoice] = useState<string | null>(null);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const data = {
          [question.id]: e.currentTarget[question.id].value,
        };
        e.currentTarget[question.id].value = "";
        onSubmit(data);
        // reset form
      }}>
      <Headline headline={question.headline} questionId={question.id} />
      <Subheader subheader={question.subheader} questionId={question.id} />
      <div className="fb-mt-4">
        <fieldset>
          <legend className="fb-sr-only">Choices</legend>
          <div className="fb-relative fb-space-y-2 fb-rounded-md fb-bg-white">
            {question.choices &&
              question.choices.map((choice) => (
                <label
                  key={choice.id}
                  className={cn(
                    selectedChoice === choice.label
                      ? "fb-z-10 border-slate-400 bg-slate-50"
                      : "fb-border-gray-200",
                    "fb-relative fb-flex fb-cursor-pointer fb-flex-col fb-rounded-md fb-border fb-p-4 focus:fb-outline-none hover:bg-slate-50"
                  )}>
                  <span className="fb-flex fb-items-center fb-text-sm">
                    <input
                      type="radio"
                      id={choice.id}
                      name={question.id}
                      value={choice.label}
                      className="fb-h-4 fb-w-4 fb-border fb-border-gray-300 focus:fb-ring-0 focus:fb-ring-offset-0"
                      aria-labelledby={`${choice.id}-label`}
                      onChange={(e) => {
                        setSelectedChoice(e.currentTarget.value);
                      }}
                      style={{ borderColor: brandColor, color: brandColor }}
                    />
                    <span id={`${choice.id}-label`} className="fb-ml-3 fb-font-medium">
                      {choice.label}
                    </span>
                  </span>
                </label>
              ))}
          </div>
        </fieldset>
      </div>
      <div className="fb-mt-4 fb-flex fb-w-full fb-justify-between">
        <div></div>
        <button
          type="submit"
          className="fb-flex fb-items-center fb-rounded-md fb-border fb-border-transparent fb-px-3 fb-py-3 fb-text-base fb-font-medium fb-leading-4 fb-text-white fb-shadow-sm hover:fb-opacity-90 focus:fb-outline-none focus:fb-ring-2 focus:fb-ring-offset-2 focus:ring-slate-500"
          style={{ backgroundColor: brandColor }}>
          {question.buttonLabel || (lastQuestion ? "Finish" : "Next")}
        </button>
      </div>
    </form>
  );
}
