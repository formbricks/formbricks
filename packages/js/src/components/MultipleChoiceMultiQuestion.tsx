import { h } from "preact";
import { useEffect, useState } from "preact/hooks";
import { cn } from "../lib/utils";
import type { MultipleChoiceMultiQuestion } from "@formbricks/types/questions";
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
  const [selectedChoices, setSelectedChoices] = useState<string[]>([]);

  const isAtLeastOneChecked = () => {
    return selectedChoices.length > 0;
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!isAtLeastOneChecked() && question.required) return;

        const data = {
          [question.id]: selectedChoices,
        };

        onSubmit(data);
        setSelectedChoices([]); // reset value
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
                    selectedChoices.includes(choice.label)
                      ? "fb-z-10 fb-border-slate-400 fb-bg-slate-50"
                      : "fb-border-gray-200",
                    "fb-relative fb-flex fb-cursor-pointer fb-flex-col fb-rounded-md fb-border fb-p-4 hover:fb-bg-slate-50 focus:fb-outline-none"
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
                      checked={selectedChoices.includes(choice.label)}
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
      <input
        type="text"
        className="clip-[rect(0,0,0,0)] fb-absolute fb-m-[-1px] fb-h-1 fb-w-1 fb-overflow-hidden fb-whitespace-nowrap fb-border-0 fb-p-0 fb-text-transparent fb-caret-transparent focus:fb-border-transparent focus:fb-ring-0"
        required={question.required}
        value={isAtLeastOneChecked() ? "checked" : ""}
      />
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
