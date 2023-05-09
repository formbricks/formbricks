import clsx from "clsx";
import type { MultipleChoiceSingleQuestion as MultipleChoiceSingleQuestionType } from "./questionTypes";
import { useState } from "react";
import Headline from "./Headline";
import Subheader from "./Subheader";

interface MultipleChoiceSingleProps {
  question: MultipleChoiceSingleQuestionType;
  onSubmit: (data: { [x: string]: any }) => void;
  lastQuestion: boolean;
  brandColor: string;
}

export const MultipleChoiceSingleQuestion: React.FC<MultipleChoiceSingleProps> = ({
  question,
  onSubmit,
  lastQuestion,
  brandColor,
}) => {
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
      <div className="mt-4">
        <fieldset>
          <legend className="sr-only">Options</legend>
          <div className="relative space-y-2 rounded-md">
            {question.choices &&
              question.choices.map((choice) => (
                <label
                  key={choice.id}
                  className={clsx(
                    selectedChoice === choice.label
                      ? "z-10 border-slate-400 bg-slate-50 dark:border-slate-600 dark:bg-slate-600"
                      : "border-gray-200 dark:border-slate-500",
                    "relative flex cursor-pointer flex-col rounded-md border p-4 hover:bg-slate-50 focus:outline-none dark:hover:bg-slate-600"
                  )}>
                  <span className="flex items-center text-sm">
                    <input
                      type="radio"
                      id={choice.id}
                      name={question.id}
                      value={choice.label}
                      className="h-4 w-4 border border-gray-300 focus:ring-0 focus:ring-offset-0 dark:bg-slate-500"
                      aria-labelledby={`${choice.id}-label`}
                      onChange={(e) => {
                        setSelectedChoice(e.currentTarget.value);
                      }}
                      style={{ borderColor: brandColor, color: brandColor }}
                    />
                    <span
                      id={`${choice.id}-label`}
                      className="ml-3 font-medium text-slate-800 dark:text-slate-300">
                      {choice.label}
                    </span>
                  </span>
                </label>
              ))}
          </div>
        </fieldset>
      </div>
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
};

export default MultipleChoiceSingleQuestion;
