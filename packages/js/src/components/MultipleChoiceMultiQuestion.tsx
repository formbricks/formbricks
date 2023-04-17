import { h } from "preact";
import { useState } from "preact/hooks";
import { cn } from "../lib/utils";
import type { MultipleChoiceMultiQuestion } from "@formbricks/types/js";
import Headline from "./Headline";
import Subheader from "./Subheader";

interface MultipleChoiceMultiProps {
  question: MultipleChoiceMultiQuestion;
  onSubmit: (data: { [x: string]: any }) => void;
  lastQuestion: boolean;
  brandColor: string;
}

export default function MultipleChoiceMultiQuestion({
  question,
  onSubmit,
  lastQuestion,
  brandColor,
}: MultipleChoiceMultiProps) {
  const [selectedChoices, setSelectedChoices] = useState([]);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const data = {
          [question.id]: selectedChoices,
        };
        console.log("data", data);
        // e.currentTarget[question.id].value = "";
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
                    choice.label in selectedChoices
                      ? "fb-z-10 fb-bg-slate-50 fb-border-slate-400"
                      : "fb-border-gray-200",
                    "fb-relative fb-flex fb-cursor-pointer fb-flex-col fb-rounded-md fb-border fb-p-4 focus:fb-outline-none hover:bg-slate-50"
                  )}>
                  <span className="fb-flex fb-items-center fb-text-sm">
                    <input
                      type="checkbox"
                      id={choice.id}
                      name={question.id}
                      value={choice.label}
                      className="fb-h-4 fb-w-4 fb-border fb-border-slate-300 focus:fb-ring-0 focus:fb-ring-offset-0"
                      aria-labelledby={`${choice.id}-label`}
                      onChange={(e) => {
                        if (e.currentTarget.checked) {
                          setSelectedChoices([...selectedChoices, e.currentTarget.value]);
                        } else {
                          setSelectedChoices(
                            selectedChoices.filter((label) => label !== e.currentTarget.value)
                          );
                        }
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
