import { TResponseData } from "@formbricks/types/v1/responses";
import type { TSurveyMultipleChoiceMultiQuestion } from "@formbricks/types/v1/surveys";
import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import { cn, shuffleQuestions } from "../../lib/utils";
import { BackButton } from "../buttons/BackButton";
import SubmitButton from "../buttons/SubmitButton";
import Headline from "../general/Headline";
import Subheader from "../general/Subheader";

interface MultipleChoiceSingleProps {
  question: TSurveyMultipleChoiceMultiQuestion;
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
  const [otherValue, setOtherValue] = useState(
    (Array.isArray(value) && value.filter((v) => !question.choices.find((c) => c.label === v))[0]) || ""
  ); // initially set to the first value that is not in choices

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

  const addItem = (item: string) => {
    if (Array.isArray(value)) {
      return onChange({ [question.id]: [...value, item] });
    }
    return onChange({ [question.id]: [item] }); // if not array, make it an array
  };

  const removeItem = (item: string) => {
    if (Array.isArray(value)) {
      return onChange({ [question.id]: value.filter((i) => i !== item) });
    }
    return onChange({ [question.id]: [] }); // if not array, make it an array
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!value || (Array.isArray(value) && value.length === 0)) {
          return;
        }
        onSubmit({ [question.id]: value });
      }}
      className="w-full">
      <Headline headline={question.headline} questionId={question.id} />
      <Subheader subheader={question.subheader} questionId={question.id} />
      <div className="mt-4">
        <fieldset>
          <legend className="sr-only">Options</legend>
          <div className="relative max-h-[42vh] space-y-2 overflow-y-auto rounded-md bg-[--fb-bg] py-0.5 pr-2">
            {questionChoices.map((choice) => (
              <label
                key={choice.id}
                className={cn(
                  value === choice.label
                    ? "z-10 border-[--fb-border-highlight] bg-[--fb-bg-selected]"
                    : "border-[--fb-border]",
                  "relative flex cursor-pointer flex-col rounded-md border p-4 text-[--fb-text] hover:bg-[--fb-bg-2] focus:outline-none"
                )}>
                <span className="flex items-center text-sm">
                  <input
                    type="checkbox"
                    id={choice.id}
                    name={question.id}
                    value={choice.label}
                    className="h-4 w-4 border border-[--fb-primary] text-[--fb-primary] focus:ring-0 focus:ring-offset-0"
                    aria-labelledby={`${choice.id}-label`}
                    onChange={(e) => {
                      if ((e.target as HTMLInputElement)?.checked) {
                        addItem(choice.label);
                      } else {
                        removeItem(choice.label);
                      }
                    }}
                    checked={Array.isArray(value) && value.includes(choice.label)}
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
                  value === otherOption.label
                    ? "z-10 border-[--fb-border-highlight] bg-[--fb-bg-selected]"
                    : "border-[--fb-border]",
                  "relative flex cursor-pointer flex-col rounded-md border p-4 text-[--fb-text] hover:bg-[--fb-bg-2] focus:outline-none"
                )}>
                <span className="flex items-center text-sm">
                  <input
                    type="checkbox"
                    id={otherOption.id}
                    name={question.id}
                    value={otherOption.label}
                    className="h-4 w-4 border border-[--fb-primary] text-[--fb-primary] focus:ring-0 focus:ring-offset-0"
                    aria-labelledby={`${otherOption.id}-label`}
                    onChange={(e) => {
                      setOtherSelected(!otherSelected);
                      if ((e.target as HTMLInputElement)?.checked) {
                        if (!otherValue) return;
                        addItem(otherValue);
                      } else {
                        removeItem(otherValue);
                      }
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
                    id={`${otherOption.id}-label`}
                    name={question.id}
                    value={otherValue}
                    onChange={(e) => {
                      setOtherValue(e.currentTarget.value);
                      removeItem(otherValue);
                      addItem(e.currentTarget.value);
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
