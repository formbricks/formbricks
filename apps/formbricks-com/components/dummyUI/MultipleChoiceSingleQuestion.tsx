import { useState } from "react";

import { cn } from "@formbricks/lib/cn";
import { getLocalizedValue } from "@formbricks/lib/utils/i18n";
import { TSurveyMultipleChoiceSingleQuestion } from "@formbricks/types/surveys";

import Headline from "./Headline";
import Subheader from "./Subheader";

interface MultipleChoiceSingleProps {
  question: TSurveyMultipleChoiceSingleQuestion;
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
  const defaultLanguage = "en";

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const data = {
          [question.id]: e.currentTarget[question.id].value,
        };

        onSubmit(data);
        setSelectedChoice(null); // reset form
      }}>
      <Headline headline={getLocalizedValue(question.headline, defaultLanguage)} questionId={question.id} />
      <Subheader
        subheader={getLocalizedValue(question.subheader, defaultLanguage)}
        questionId={question.id}
      />
      <div className="mt-4">
        <fieldset>
          <legend className="sr-only">Options</legend>
          <div className="relative space-y-2 rounded-md">
            {question.choices &&
              question.choices.map((choice, idx) => (
                <label
                  key={choice.id}
                  className={cn(
                    selectedChoice === getLocalizedValue(choice.label, defaultLanguage)
                      ? "z-10 border-slate-400 bg-slate-50 dark:border-slate-400 dark:bg-slate-600"
                      : "border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:hover:bg-slate-600",
                    "relative flex cursor-pointer flex-col rounded-md border p-4 hover:bg-slate-50 focus:outline-none"
                  )}>
                  <span className="flex items-center text-sm">
                    <input
                      type="radio"
                      id={choice.id}
                      name={question.id}
                      value={getLocalizedValue(choice.label, defaultLanguage)}
                      className="h-4 w-4 border border-slate-300 focus:ring-0 focus:ring-offset-0 dark:border-slate-600 dark:bg-slate-500"
                      aria-labelledby={`${choice.id}-label`}
                      onChange={(e) => {
                        setSelectedChoice(e.currentTarget.value);
                      }}
                      checked={selectedChoice === getLocalizedValue(choice.label, defaultLanguage)}
                      style={{ borderColor: brandColor, color: brandColor }}
                      required={question.required && idx === 0}
                    />
                    <span
                      id={`${choice.id}-label`}
                      className="ml-3 font-medium text-slate-900 dark:text-slate-200">
                      {getLocalizedValue(choice.label, defaultLanguage)}
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
          {getLocalizedValue(question.buttonLabel, defaultLanguage) || (lastQuestion ? "Finish" : "Next")}
        </button>
      </div>
    </form>
  );
}
