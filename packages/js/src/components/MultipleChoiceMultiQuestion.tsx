import { h } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";
import { TResponseData } from "../../../types/v1/responses";
import type { TSurveyChoice, TSurveyMultipleChoiceMultiQuestion } from "../../../types/v1/surveys";
import { cn, shuffleArray } from "../lib/utils";
import Headline from "./Headline";
import Subheader from "./Subheader";
import SubmitButton from "./SubmitButton";
import { BackButton } from "./BackButton";
import { symmetricDifference } from "../../../lib/utils/array";

interface MultipleChoiceMultiProps {
  question: TSurveyMultipleChoiceMultiQuestion;
  onSubmit: (data: TResponseData) => void;
  lastQuestion: boolean;
  brandColor: string;
  storedResponseValue: string[] | null;
  goToNextQuestion: (answer: TResponseData) => void;
  goToPreviousQuestion?: (answer: TResponseData) => void;
}

export default function MultipleChoiceMultiQuestion({
  question,
  onSubmit,
  lastQuestion,
  brandColor,
  storedResponseValue,
  goToNextQuestion,
  goToPreviousQuestion,
}: MultipleChoiceMultiProps) {
  const [selectedChoices, setSelectedChoices] = useState<string[]>([]);
  const [showOther, setShowOther] = useState(false);
  const [otherSpecified, setOtherSpecified] = useState("");
  const [questionChoices, setQuestionChoices] = useState<TSurveyChoice[]>(
    question.choices
      ? question.shuffleOption && question.shuffleOption !== "none"
        ? shuffleArray(question.choices, question.shuffleOption)
        : question.choices
      : []
  );
  const otherInputRef = useRef(null);

  const isAtLeastOneChecked = () => {
    return selectedChoices.length > 0 || otherSpecified.length > 0;
  };

  const nonOtherChoiceLabels = question.choices
    .filter((label) => label.id !== "other")
    .map((choice) => choice.label);

  useEffect(() => {
    const nonOtherSavedChoices = storedResponseValue?.filter((answer) =>
      nonOtherChoiceLabels.includes(answer)
    );
    const savedOtherSpecified = storedResponseValue?.find((answer) => !nonOtherChoiceLabels.includes(answer));

    setSelectedChoices(nonOtherSavedChoices ?? []);

    if (savedOtherSpecified) {
      setOtherSpecified(savedOtherSpecified);
      setShowOther(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storedResponseValue, question.id]);

  useEffect(() => {
    if (showOther && otherInputRef.current) {
      otherInputRef.current.value = otherSpecified ?? "";
      otherInputRef.current.focus();
    }
  }, [otherSpecified, showOther]);

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
    setSelectedChoices([]); // reset value
    setShowOther(false);
    setOtherSpecified("");
  };

  const handleSubmit = () => {
    const data = {
      [question.id]: selectedChoices,
    };

    if (!!storedResponseValue && symmetricDifference(selectedChoices, storedResponseValue).length === 0) {
      goToNextQuestion(data);
      return;
    }

    if (question.required && selectedChoices.length <= 0) {
      return;
    }

    onSubmit(data);
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (otherSpecified.length > 0 && showOther) {
          selectedChoices.push(otherSpecified);
        }
        handleSubmit();
        resetForm();
      }}>
      <Headline headline={question.headline} questionId={question.id} />
      <Subheader subheader={question.subheader} questionId={question.id} />
      <div className="fb-mt-4">
        <fieldset>
          <legend className="fb-sr-only">Options</legend>
          <div className="fb-relative fb-space-y-2 fb-rounded-md fb-bg-white">
            {questionChoices.map((choice) => (
              <label
                key={choice.id}
                className={cn(
                  selectedChoices.includes(choice.label)
                    ? "fb-z-10 fb-border-slate-400 fb-bg-slate-50"
                    : "fb-border-gray-200",
                  "fb-relative fb-flex fb-cursor-pointer fb-flex-col fb-space-y-3 fb-rounded-md fb-border fb-p-4 hover:fb-bg-slate-50 focus:fb-outline-none fb-text-slate-800"
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
                      if (choice.id === "other") {
                        setShowOther(e.currentTarget.checked);

                        return;
                      }

                      if (e.currentTarget.checked) {
                        setSelectedChoices([...selectedChoices, e.currentTarget.value]);
                      } else {
                        setSelectedChoices(
                          selectedChoices.filter((label) => label !== e.currentTarget.value)
                        );
                      }
                    }}
                    checked={selectedChoices.includes(choice.label) || (choice.id === "other" && showOther)}
                    style={{ borderColor: brandColor, color: brandColor }}
                  />
                  <span id={`${choice.id}-label`} className="fb-ml-3 fb-font-medium">
                    {choice.label}
                  </span>
                </span>
                {choice.id === "other" && showOther && (
                  <input
                    ref={otherInputRef}
                    id={`${choice.id}-label`}
                    name={question.id}
                    placeholder="Please specify"
                    className={cn(
                      "fb-mt-3 fb-flex fb-h-10 fb-w-full fb-rounded-md fb-border fb-bg-white fb-border-slate-300 fb-bg-transparent fb-px-3 fb-py-2 fb-text-sm fb-text-slate-800 placeholder:fb-text-slate-400 focus:fb-outline-none  focus:fb-ring-2 focus:fb-ring-slate-400 focus:fb-ring-offset-2 disabled:fb-cursor-not-allowed disabled:fb-opacity-50 dark:fb-border-slate-500 dark:fb-text-slate-300"
                    )}
                    onChange={(e) => setOtherSpecified(e.currentTarget.value)}
                    aria-labelledby={`${choice.id}-label`}
                    required={question.required}
                  />
                )}
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
        {goToPreviousQuestion && (
          <BackButton
            backButtonLabel={question.backButtonLabel}
            onClick={() => {
              if (otherSpecified.length > 0 && showOther) {
                selectedChoices.push(otherSpecified);
              }
              goToPreviousQuestion({
                [question.id]: selectedChoices,
              });
              resetForm();
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
