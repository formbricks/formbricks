import { TResponseData } from "@formbricks/types/v1/responses";
import type { TSurveyMultipleChoiceSingleQuestion } from "@formbricks/types/v1/surveys";
import { useMemo, useRef, useState, useEffect } from "preact/hooks";
import { cn, shuffleQuestions } from "../lib/utils";
import { BackButton } from "./BackButton";
import Headline from "./Headline";
import Subheader from "./Subheader";
import SubmitButton from "./SubmitButton";

interface MultipleChoiceSingleProps {
  question: TSurveyMultipleChoiceSingleQuestion;
  value: string | number | string[];
  onChange: (responseData: TResponseData) => void;
  onSubmit: (data: TResponseData) => void;
  onBack: () => void;
  isFirstQuestion: boolean;
  isLastQuestion: boolean;
  brandColor: string;
}

export default function MultipleChoiceSingleQuestion({
  question,
  value,
  onChange,
  onSubmit,
  onBack,
  isFirstQuestion,
  isLastQuestion,
  brandColor,
}: MultipleChoiceSingleProps) {
  const [otherSelected, setOtherSelected] = useState(
    !!value && !question.choices.find((c) => c.label === value)
  ); // initially set to true if value is not in choices

  const questionChoices = useMemo(() => {
    if (!question.choices) {
      return [];
    }
    const choicesWithoutOther = question.choices.filter((choice) => choice.id !== "other");
    if (question.shuffleOption) {
      return shuffleQuestions(choicesWithoutOther, question.shuffleOption);
    }
    return choicesWithoutOther;
  }, [question.choices, question.shuffleOption]);

  const otherOption = useMemo(
    () => question.choices.find((choice) => choice.id === "other"),
    [question.choices]
  );

  const otherSpecify = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (otherSelected) {
      otherSpecify.current?.focus();
    }
  }, [otherSelected]);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({ [question.id]: value });
      }}
      className="w-full">
      <Headline headline={question.headline} questionId={question.id} required={question.required} />
      <Subheader subheader={question.subheader} questionId={question.id} />
      <div className="mt-4">
        <fieldset>
          <legend className="sr-only">Options</legend>
          <div className="relative max-h-[42vh] space-y-2 overflow-y-auto rounded-md bg-white py-0.5 pr-2">
            {questionChoices.map((choice, idx) => (
              <label
                key={choice.id}
                className={cn(
                  value === choice.label ? "z-10 border-slate-400 bg-slate-50" : "border-gray-200",
                  "relative flex cursor-pointer flex-col rounded-md border p-4 text-slate-800 hover:bg-slate-50 focus:outline-none"
                )}>
                <span className="flex items-center text-sm">
                  <input
                    type="radio"
                    id={choice.id}
                    name={question.id}
                    value={choice.label}
                    className="h-4 w-4 border border-slate-300 focus:ring-0 focus:ring-offset-0"
                    aria-labelledby={`${choice.id}-label`}
                    onChange={() => {
                      setOtherSelected(false);
                      onChange({ [question.id]: choice.label });
                    }}
                    checked={value === choice.label}
                    style={{ borderColor: brandColor, color: brandColor }}
                    required={question.required && idx === 0}
                  />
                  <span id={`${choice.id}-label`} className="ml-3 font-medium">
                    {choice.label}
                  </span>
                </span>
              </label>
            ))}
            {otherOption && (
              <label
                className={cn(
                  value === otherOption.label ? "z-10 border-slate-400 bg-slate-50" : "border-gray-200",
                  "relative flex cursor-pointer flex-col rounded-md border p-4 text-slate-800 hover:bg-slate-50 focus:outline-none"
                )}>
                <span className="flex items-center text-sm">
                  <input
                    type="radio"
                    id={otherOption.id}
                    name={question.id}
                    value={otherOption.label}
                    className="h-4 w-4 border border-slate-300 focus:ring-0 focus:ring-offset-0"
                    aria-labelledby={`${otherOption.id}-label`}
                    onChange={() => {
                      setOtherSelected(!otherSelected);
                      onChange({ [question.id]: "" });
                    }}
                    checked={otherSelected}
                    style={{ borderColor: brandColor, color: brandColor }}
                  />
                  <span id={`${otherOption.id}-label`} className="ml-3 font-medium">
                    {otherOption.label}
                  </span>
                </span>
                {otherSelected && (
                  <input
                    ref={otherSpecify}
                    id={`${otherOption.id}-label`}
                    name={question.id}
                    value={value}
                    onChange={(e) => {
                      onChange({ [question.id]: e.currentTarget.value });
                    }}
                    placeholder="Please specify"
                    className="mt-3 flex h-10 w-full rounded-md border border-slate-300 bg-transparent bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none  focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-500 dark:text-slate-300"
                    required={question.required}
                    aria-labelledby={`${otherOption.id}-label`}
                  />
                )}
              </label>
            )}
          </div>
        </fieldset>
      </div>
      <div className="mt-4 flex w-full justify-between">
        {!isFirstQuestion && <BackButton backButtonLabel={question.backButtonLabel} onClick={onBack} />}
        <div></div>
        <SubmitButton
          question={question}
          isLastQuestion={isLastQuestion}
          brandColor={brandColor}
          onClick={() => {}}
        />
      </div>
    </form>
  );
}
