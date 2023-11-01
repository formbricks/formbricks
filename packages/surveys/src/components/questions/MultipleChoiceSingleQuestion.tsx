import { cn, shuffleQuestions } from "../../lib/utils";
import { BackButton } from "../buttons/BackButton";
import SubmitButton from "../buttons/SubmitButton";
import Headline from "../general/Headline";
import Subheader from "../general/Subheader";
import { TResponseData } from "@formbricks/types/responses";
import type { TSurveyMultipleChoiceSingleQuestion } from "@formbricks/types/surveys";
import { useMemo, useRef, useState, useEffect } from "preact/hooks";

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
      {question.imageUrl && (
        <div className="my-4 rounded-md">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={question.imageUrl} alt="question-image" className={"my-4 rounded-md"} />
        </div>
      )}
      <Headline headline={question.headline} questionId={question.id} required={question.required} />
      <Subheader subheader={question.subheader} questionId={question.id} />
      <div className="mt-4">
        <fieldset>
          <legend className="sr-only">Options</legend>

          <div
            className="relative max-h-[42vh] space-y-2 overflow-y-auto rounded-md bg-[--fb-bg] py-0.5 pr-2"
            role="radiogroup">
            {questionChoices.map((choice, idx) => (
              <label
                key={choice.id}
                tabIndex={idx + 1}
                onKeyDown={(e) => {
                  if (e.key == "Enter") {
                    onChange({ [question.id]: choice.label });
                    setTimeout(() => {
                      onSubmit({ [question.id]: choice.label });
                    }, 350);
                  }
                }}
                className={cn(
                  value === choice.label
                    ? "z-10 border-[--fb-border-highlight] bg-[--fb-bg-selected]"
                    : "border-[--fb-border]",
                  "relative flex cursor-pointer flex-col rounded-md border p-4 text-[--fb-text] focus-within:border-[--fb-border-highlight] focus-within:bg-[--fb-bg-2] hover:bg-[--fb-bg-2] focus:outline-none"
                )}>
                <span className="flex items-center text-sm">
                  <input
                    tabIndex={-1}
                    type="radio"
                    id={choice.id}
                    name={question.id}
                    value={choice.label}
                    className="h-4 w-4 border border-[--fb-brand-color] text-[--fb-brand-color] focus:ring-0 focus:ring-offset-0"
                    aria-labelledby={`${choice.id}-label`}
                    onChange={() => {
                      setOtherSelected(false);
                      onChange({ [question.id]: choice.label });
                    }}
                    checked={value === choice.label}
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
                tabIndex={questionChoices.length + 1}
                className={cn(
                  value === otherOption.label
                    ? "z-10 border-[--fb-border-highlight] bg-[--fb-bg-selected]"
                    : "border-[--fb-border]",
                  "relative flex cursor-pointer flex-col rounded-md border p-4 text-[--fb-text] focus-within:border-[--fb-border-highlight] focus-within:bg-[--fb-bg-2] hover:bg-[--fb-bg-2] focus:outline-none"
                )}
                onKeyDown={(e) => {
                  if (e.key == "Enter") {
                    setOtherSelected(!otherSelected);
                    if (!otherSelected) onChange({ [question.id]: "" });
                  }
                }}>
                <span className="flex items-center text-sm">
                  <input
                    type="radio"
                    id={otherOption.id}
                    tabIndex={-1}
                    name={question.id}
                    value={otherOption.label}
                    className="h-4 w-4 border border-[--fb-brand-color] text-[--fb-brand-color] focus:ring-0 focus:ring-offset-0"
                    aria-labelledby={`${otherOption.id}-label`}
                    onChange={() => {
                      setOtherSelected(!otherSelected);
                      onChange({ [question.id]: "" });
                    }}
                    checked={otherSelected}
                  />
                  <span id={`${otherOption.id}-label`} className="ml-3 font-medium">
                    {otherOption.label}
                  </span>
                </span>
                {otherSelected && (
                  <input
                    ref={otherSpecify}
                    tabIndex={questionChoices.length + 1}
                    id={`${otherOption.id}-label`}
                    name={question.id}
                    value={value}
                    onChange={(e) => {
                      onChange({ [question.id]: e.currentTarget.value });
                    }}
                    onKeyDown={(e) => {
                      if (e.key == "Enter") {
                        setTimeout(() => {
                          onSubmit({ [question.id]: value });
                        }, 100);
                      }
                    }}
                    placeholder="Please specify"
                    className="mt-3 flex h-10 w-full rounded-md border border-[--fb-border] bg-[--fb-bg] px-3 py-2 text-sm text-[--fb-text] placeholder:text-[--fb-placeholder] focus:outline-none  focus:ring-2 focus:ring-[--fb-ring-focus] focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
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
        {!isFirstQuestion && (
          <BackButton
            backButtonLabel={question.backButtonLabel}
            tabIndex={questionChoices.length + 3}
            onClick={onBack}
          />
        )}
        <div></div>
        <SubmitButton
          tabIndex={questionChoices.length + 2}
          buttonLabel={question.buttonLabel}
          isLastQuestion={isLastQuestion}
          onClick={() => {}}
          brandColor={brandColor}
        />
      </div>
    </form>
  );
}
