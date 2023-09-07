import SubmitButton from "@/components/preview/SubmitButton";
import { shuffleArray } from "@/lib/utils";
import { cn } from "@formbricks/lib/cn";
import { Response } from "@formbricks/types/js";
import { MultipleChoiceSingleQuestion } from "@formbricks/types/questions";
import { TSurveyChoice, TSurveyMultipleChoiceSingleQuestion } from "@formbricks/types/v1/surveys";
import { Input } from "@formbricks/ui";
import { useEffect, useRef, useState } from "react";
import Headline from "./Headline";
import Subheader from "./Subheader";
import { BackButton } from "@/components/preview/BackButton";

interface MultipleChoiceSingleProps {
  question: MultipleChoiceSingleQuestion | TSurveyMultipleChoiceSingleQuestion;
  onSubmit: (data: { [x: string]: any }) => void;
  lastQuestion: boolean;
  brandColor: string;
  storedResponseValue: string | null;
  goToNextQuestion: (answer: Response["data"]) => void;
  goToPreviousQuestion?: (answer?: Response["data"]) => void;
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
    if (selectedChoice === "other" && otherSpecify.current) {
      otherSpecify.current.value = savedOtherAnswer ?? "";
      otherSpecify.current.focus();
    }
  }, [savedOtherAnswer, selectedChoice]);

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

  useEffect(() => {
    setQuestionChoices(
      question.choices
        ? question.shuffleOption && question.shuffleOption !== "none"
          ? shuffleArray(question.choices, question.shuffleOption)
          : question.choices
        : []
    );
  }, [question.choices, question.shuffleOption]);

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
          <div className="relative space-y-2 rounded-md py-0.5">
            {questionChoices.map((choice, idx) => (
              <label
                key={choice.id}
                className={cn(
                  selectedChoice === choice.label ? "z-10 border-slate-400 bg-slate-50" : "border-gray-200",
                  "relative mb-2 flex cursor-pointer flex-col rounded-md border p-4 hover:bg-slate-50 focus:outline-none"
                )}>
                <span className="flex flex-col text-sm">
                  <span className="flex items-center">
                    <input
                      type="radio"
                      id={choice.id}
                      name={question.id}
                      value={choice.label}
                      className="h-4 w-4 border border-gray-300 focus:ring-0 focus:ring-offset-0"
                      aria-labelledby={`${choice.id}-label`}
                      onChange={() => setSelectedChoice(choice.id)}
                      checked={selectedChoice === choice.id}
                      style={{ borderColor: brandColor, color: brandColor }}
                      required={question.required && idx === 0}
                    />
                    <span id={`${choice.id}-label`} className="ml-3 font-medium">
                      {choice.label}
                    </span>
                  </span>
                  {choice.id === "other" && selectedChoice === "other" && (
                    <Input
                      id={`${choice.id}-label`}
                      ref={otherSpecify}
                      name={question.id}
                      placeholder="Please specify"
                      className="mt-3 bg-white focus:border-slate-300"
                      required={question.required}
                      aria-labelledby={`${choice.id}-label`}
                      autoFocus
                    />
                  )}
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      </div>
      <div className="mt-4 flex w-full justify-between">
        {goToPreviousQuestion && (
          <BackButton
            backButtonLabel={question.backButtonLabel}
            onClick={() => {
              goToPreviousQuestion(
                selectedChoice === "other"
                  ? {
                      [question.id]: otherSpecify.current?.value ?? "",
                    }
                  : {
                      [question.id]:
                        question.choices.find((choice) => choice.id === selectedChoice)?.label ?? "",
                    }
              );
            }}
          />
        )}
        <div></div>
        <SubmitButton {...{ question, lastQuestion, brandColor }} />
      </div>
    </form>
  );
}
