import { h } from "preact";
import { useState } from "preact/hooks";
import { cn } from "../lib/utils";
import type { NPSQuestion } from "@formbricks/types/questions";
import Headline from "./Headline";
import Subheader from "./Subheader";

interface NPSQuestionProps {
  question: NPSQuestion;
  onSubmit: (data: { [x: string]: any }) => void;
  lastQuestion: boolean;
  brandColor: string;
}

export default function NPSQuestion({ question, onSubmit, lastQuestion, brandColor }: NPSQuestionProps) {
  const [selectedChoice, setSelectedChoice] = useState<number | null>(null);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();

        const data = {
          [question.id]: selectedChoice,
        };

        onSubmit(data);
        // reset form
      }}>
      <Headline headline={question.headline} questionId={question.id} />
      <Subheader subheader={question.subheader} questionId={question.id} />
      <div className="fb-my-4">
        <fieldset>
          <legend className="fb-sr-only">Choices</legend>
          <div className="fb-flex">
            {Array.from({ length: 11 }, (_, i) => i).map((number) => (
              <label
                key={number}
                className={cn(
                  selectedChoice === number ? "fb-z-10 fb-border-slate-400 fb-bg-slate-50" : "",
                  "fb-relative fb-h-10 fb-flex-1 fb-cursor-pointer fb-border fb-bg-white fb-text-center fb-text-sm fb-leading-10 fb-hover:bg-gray-100 fb-focus:outline-none"
                )}>
                <input
                  type="radio"
                  name="nps"
                  value={number}
                  className="fb-absolute fb-h-full fb-w-full fb-cursor-pointer fb-opacity-0"
                  onChange={() => setSelectedChoice(number)}
                  required={question.required}
                />
                {number}
              </label>
            ))}
          </div>
          <div className="fb-flex fb-justify-between fb-text-sm fb-font-semibold fb-leading-6">
            <p>{question.lowerLabel}</p>
            <p>{question.upperLabel}</p>
          </div>
        </fieldset>
      </div>
      <div className="fb-mt-4 fb-flex fb-w-full fb-justify-between">
        <div></div>
        <button
          type="submit"
          className="fb-flex fb-items-center fb-rounded-md fb-border fb-border-transparent fb-px-3 fb-py-3 fb-text-base fb-font-medium fb-leading-4 fb-text-white fb-shadow-sm fb-hover:opacity-90 fb-focus:outline-none fb-focus:ring-2 fb-focus:ring-slate-500 fb-focus:ring-offset-2"
          style={{ backgroundColor: brandColor }}>
          {question.buttonLabel || (lastQuestion ? "Finish" : "Next")}
        </button>
      </div>
    </form>
  );
}
