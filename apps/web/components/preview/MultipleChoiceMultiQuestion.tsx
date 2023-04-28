import { useState, useEffect } from "react";
import { cn } from "@formbricks/lib/cn";
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
  const [isAtLeastOneChecked, setIsAtLeastOneChecked] = useState(false);

  useEffect(() => {
    setIsAtLeastOneChecked(selectedChoices.length > 0);
  }, [selectedChoices]);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();

        if (question.required && selectedChoices.length <= 0) {
          return;
        }

        const data = {
          [question.id]: selectedChoices,
        };
        onSubmit(data);
        setSelectedChoices([]); // reset value
      }}>
      <Headline headline={question.headline} questionId={question.id} />
      <Subheader subheader={question.subheader} questionId={question.id} />
      <div className="mt-4">
        <fieldset>
          <legend className="sr-only">Options</legend>
          <div className="relative space-y-2 rounded-md bg-white">
            {question.choices &&
              question.choices.map((choice) => (
                <label
                  key={choice.id}
                  className={cn(
                    selectedChoices.includes(choice.label)
                      ? "z-10 border-slate-400 bg-slate-50"
                      : "border-gray-200",
                    "relative flex cursor-pointer flex-col rounded-md border p-4 hover:bg-slate-50 focus:outline-none"
                  )}>
                  <span className="flex items-center text-sm">
                    <input
                      type="checkbox"
                      id={choice.id}
                      name={question.id}
                      value={choice.label}
                      className="h-4 w-4 border border-slate-300 focus:ring-0 focus:ring-offset-0"
                      aria-labelledby={`${choice.id}-label`}
                      checked={selectedChoices.includes(choice.label)}
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
                    <span id={`${choice.id}-label`} className="ml-3 font-medium">
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
        className="clip-[rect(0,0,0,0)] absolute m-[-1px] h-1 w-1 overflow-hidden whitespace-nowrap border-0 p-0 text-transparent caret-transparent focus:border-transparent focus:ring-0"
        required={question.required}
        value={isAtLeastOneChecked ? "checked" : ""}
        onChange={() => {}}
      />
      <div className="mt-4 flex w-full justify-between">
        <div></div>
        <button
          type="submit"
          className="flex items-center rounded-md border border-transparent px-3 py-3 text-base font-medium leading-4 text-white shadow-sm hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2"
          style={{ backgroundColor: brandColor }}>
          {question.buttonLabel || (lastQuestion ? "Finish" : "Next")}
        </button>
      </div>
    </form>
  );
}
