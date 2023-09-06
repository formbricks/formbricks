import { h } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";
import { TResponseData } from "../../../types/v1/responses";
import type { TSurveyChoice, TSurveyMultipleChoiceSingleQuestion } from "../../../types/v1/surveys";
import { cn, shuffleArray } from "../lib/utils";
import Headline from "./Headline";
import Subheader from "./Subheader";
import SubmitButton from "./SubmitButton";
import { BackButton } from "./BackButton";

interface MultipleChoiceSingleProps {
  question: TSurveyMultipleChoiceSingleQuestion;
  onSubmit: (data: TResponseData) => void;
  lastQuestion: boolean;
  brandColor: string;
  storedResponseValue: string | null;
  goToNextQuestion: (answer: TResponseData) => void;
  goToPreviousQuestion?: (answer: TResponseData) => void;
}

export default function MultipleChoiceSingleQuestion({
  question,
  onSubmit,
  lastQuestion,
  brandColor,
  storedResponseValue,
  goToNextQuestion,
  goToPreviousQuestion,
}: MultipleChoiceSingleProps) {
  const storedResponseValueValue = question.choices.find(
    (choice) => choice.label === storedResponseValue
  )?.id;
  const [selectedChoice, setSelectedChoice] = useState<string | null>(null);
  const [savedOtherAnswer, setSavedOtherAnswer] = useState<string | null>(null);
  const [questionChoices, setQuestionChoices] = useState<TSurveyChoice[]>(
    question.choices
      ? question.shuffleOption && question.shuffleOption !== "none"
        ? shuffleArray(question.choices, question.shuffleOption)
        : question.choices
      : []
  );
  const otherSpecify = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!storedResponseValueValue) {
      const otherChoiceId = question.choices.find((choice) => choice.id === "other")?.id;
      if (otherChoiceId && storedResponseValue) {
        setSelectedChoice(otherChoiceId);
        setSavedOtherAnswer(storedResponseValue);
      }
    } else {
      setSelectedChoice(storedResponseValueValue);
    }
  }, [question.choices, storedResponseValue, storedResponseValueValue]);

  useEffect(() => {
    if (selectedChoice === "other") {
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
    if (value === storedResponseValue) {
      goToNextQuestion(data);
      resetForm(); // reset form
      return;
    }
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
      <div className="fb-mt-4">
        <fieldset>
          <legend className="fb-sr-only">Options</legend>
          <div className="fb-relative fb-space-y-2 fb-rounded-md fb-bg-white">
            {questionChoices.map((choice, idx) => (
              <label
                key={choice.id}
                className={cn(
                  selectedChoice === choice.label
                    ? "fb-z-10 fb-bg-slate-50 fb-border-slate-400"
                    : "fb-border-gray-200",
                  "fb-relative fb-flex fb-cursor-pointer fb-flex-col fb-rounded-md fb-border fb-p-4 focus:fb-outline-none fb-text-slate-800 hover:bg-slate-50"
                )}>
                <span className="fb-flex fb-items-center fb-text-sm">
                  <input
                    type="radio"
                    id={choice.id}
                    name={question.id}
                    value={choice.label}
                    className="fb-h-4 fb-w-4 fb-border fb-border-slate-300 focus:fb-ring-0 focus:fb-ring-offset-0"
                    aria-labelledby={`${choice.id}-label`}
                    onChange={(e) => {
                      setSelectedChoice(choice.id);
                    }}
                    checked={selectedChoice === choice.id}
                    style={{ borderColor: brandColor, color: brandColor }}
                    required={question.required && idx === 0}
                  />
                  <span id={`${choice.id}-label`} className="fb-ml-3 fb-font-medium">
                    {choice.label}
                  </span>
                </span>
                {choice.id === "other" && selectedChoice === "other" && (
                  <input
                    ref={otherSpecify}
                    id={`${choice.id}-label`}
                    name={question.id}
                    placeholder="Please specify"
                    className="fb-mt-3 fb-flex fb-h-10 fb-w-full fb-rounded-md fb-border fb-bg-white fb-border-slate-300 fb-bg-transparent fb-px-3 fb-py-2 fb-text-sm fb-text-slate-800 placeholder:fb-text-slate-400 focus:fb-outline-none  focus:fb-ring-2 focus:fb-ring-slate-400 focus:fb-ring-offset-2 disabled:fb-cursor-not-allowed disabled:fb-opacity-50 dark:fb-border-slate-500 dark:fb-text-slate-300"
                    required={question.required}
                    aria-labelledby={`${choice.id}-label`}
                  />
                )}
              </label>
            ))}
          </div>
        </fieldset>
      </div>
      <div className="fb-mt-4 fb-flex fb-w-full fb-justify-between">
        {goToPreviousQuestion && (
          <BackButton
            backButtonLabel={question.backButtonLabel}
            onClick={() => {
              goToPreviousQuestion(
                selectedChoice === "other"
                  ? {
                      [question.id]: otherSpecify.current?.value,
                    }
                  : {
                      [question.id]: question.choices.find((choice) => choice.id === selectedChoice)?.label,
                    }
              );
            }}
          />
        )}
        <div></div>
        <SubmitButton
          question={question}
          lastQuestion={lastQuestion}
          brandColor={brandColor}
          onClick={() => {}}
        />
      </div>
    </form>
  );
}
