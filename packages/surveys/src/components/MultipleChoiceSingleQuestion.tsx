import { TResponseData } from "@formbricks/types/v1/responses";
import type { TSurveyChoice, TSurveyMultipleChoiceSingleQuestion } from "@formbricks/types/v1/surveys";
import { useEffect, useRef, useState } from "preact/hooks";
import { cn, shuffleArray } from "../lib/utils";
import { BackButton } from "./BackButton";
import Headline from "./Headline";
import Subheader from "./Subheader";
import SubmitButton from "./SubmitButton";

interface MultipleChoiceSingleProps {
  question: TSurveyMultipleChoiceSingleQuestion;
  onSubmit: (data: TResponseData) => void;
  onBack: (responseData: TResponseData) => void;
  isFirstQuestion: boolean;
  isLastQuestion: boolean;
  brandColor: string;
}

export default function MultipleChoiceSingleQuestion({
  question,
  onSubmit,
  onBack,
  isFirstQuestion,
  isLastQuestion,
  brandColor,
}: MultipleChoiceSingleProps) {
  const [selectedChoice, setSelectedChoice] = useState<string | null>(null);
  const [savedOtherAnswer, setSavedOtherAnswer] = useState<string | null>(null);
  const [questionChoices, setQuestionChoices] = useState<TSurveyChoice[]>(
    question.choices
      ? question.shuffleOption && question.shuffleOption !== "none"
        ? shuffleArray(question.choices, question.shuffleOption)
        : question.choices
      : []
  );
  const otherSpecify = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (selectedChoice === "other" && otherSpecify.current) {
      otherSpecify.current.value = savedOtherAnswer ?? "";
      otherSpecify.current?.focus();
    }
  }, [savedOtherAnswer, selectedChoice]);

  useEffect(() => {
    setQuestionChoices(
      question.choices
        ? question.shuffleOption && question.shuffleOption !== "none"
          ? shuffleArray(question.choices, question.shuffleOption)
          : question.choices
        : []
    );
  }, [question.choices, question.shuffleOption]);

  const resetForm = () => {
    setSelectedChoice(null);
    setSavedOtherAnswer(null);
  };

  const handleSubmit = (value: string) => {
    const data = {
      [question.id]: value,
    };
    onSubmit(data);
    resetForm(); // reset form
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();

        const value = otherSpecify.current?.value || e.currentTarget[question.id].value;
        handleSubmit(value);
      }}>
      <Headline headline={question.headline} questionId={question.id} />
      <Subheader subheader={question.subheader} questionId={question.id} />
      <div className="mt-4">
        <fieldset>
          <legend className="sr-only">Options</legend>
          <div className="relative max-h-[42vh] space-y-2 overflow-y-auto rounded-md bg-white py-0.5 pr-2">
            {questionChoices.map((choice, idx) => (
              <label
                key={choice.id}
                className={cn(
                  selectedChoice === choice.label ? "z-10 border-slate-400 bg-slate-50" : "border-gray-200",
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
                      setSelectedChoice(choice.id);
                    }}
                    checked={selectedChoice === choice.id}
                    style={{ borderColor: brandColor, color: brandColor }}
                    required={question.required && idx === 0}
                  />
                  <span id={`${choice.id}-label`} className="ml-3 font-medium">
                    {choice.label}
                  </span>
                </span>
                {choice.id === "other" && selectedChoice === "other" && (
                  <input
                    ref={otherSpecify}
                    id={`${choice.id}-label`}
                    name={question.id}
                    placeholder="Please specify"
                    className="mt-3 flex h-10 w-full rounded-md border border-slate-300 bg-transparent bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none  focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-500 dark:text-slate-300"
                    required={question.required}
                    aria-labelledby={`${choice.id}-label`}
                  />
                )}
              </label>
            ))}
          </div>
        </fieldset>
      </div>
      <div className="mt-4 flex w-full justify-between">
        {!isFirstQuestion && (
          <BackButton
            onClick={() => {
              const data: TResponseData = {};
              const value = otherSpecify.current?.value || selectedChoice;
              if (value) {
                data[question.id] = [value];
              }
              onBack(data);
            }}
          />
        )}
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
