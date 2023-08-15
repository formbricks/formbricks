import { useEffect, useRef, useState } from "preact/hooks";
import { TResponseData } from "@formbricks/types/v1/responses";
import type { TSurveyChoice, TSurveyMultipleChoiceMultiQuestion } from "@formbricks/types/v1/surveys";
import { cn, shuffleArray } from "../lib/utils";
import { BackButton } from "./BackButton";
import Headline from "./Headline";
import Subheader from "./Subheader";
import SubmitButton from "./SubmitButton";

interface MultipleChoiceMultiProps {
  question: TSurveyMultipleChoiceMultiQuestion;
  onSubmit: (data: TResponseData) => void;
  onBack: (responseData: TResponseData) => void;
  isFirstQuestion: boolean;
  isLastQuestion: boolean;
  brandColor: string;
}

export default function MultipleChoiceMultiQuestion({
  question,
  onSubmit,
  onBack,
  isFirstQuestion,
  isLastQuestion,
  brandColor,
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
  const otherInputRef = useRef<HTMLInputElement | null>(null);

  const isAtLeastOneChecked = () => {
    return selectedChoices.length > 0 || otherSpecified.length > 0;
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

  const resetForm = () => {
    setSelectedChoices([]); // reset value
    setShowOther(false);
    setOtherSpecified("");
  };

  const handleSubmit = () => {
    const data = {
      [question.id]: selectedChoices,
    };

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
      <div className="mt-4">
        <fieldset>
          <legend className="sr-only">Options</legend>
          <div className="relative max-h-[42vh] space-y-2 overflow-y-auto rounded-md bg-white py-0.5 pr-2">
            {questionChoices.map((choice) => (
              <label
                key={choice.id}
                className={cn(
                  selectedChoices.includes(choice.label)
                    ? "z-10 border-slate-400 bg-slate-50"
                    : "border-gray-200",
                  "relative flex cursor-pointer flex-col space-y-3 rounded-md border p-4 text-slate-800 hover:bg-slate-50 focus:outline-none"
                )}>
                <span className="flex items-center text-sm">
                  <input
                    type="checkbox"
                    id={choice.id}
                    name={question.id}
                    value={choice.label}
                    className="h-4 w-4 border border-slate-300 focus:ring-0 focus:ring-offset-0"
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
                  <span id={`${choice.id}-label`} className="ml-3 font-medium">
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
                      "mt-3 flex h-10 w-full rounded-md border border-slate-300 bg-transparent bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none  focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-500 dark:text-slate-300"
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
        className="clip-[rect(0,0,0,0)] absolute m-[-1px] h-1 w-1 overflow-hidden whitespace-nowrap border-0 p-0 text-transparent caret-transparent focus:border-transparent focus:ring-0"
        required={question.required}
        value={isAtLeastOneChecked() ? "checked" : ""}
      />
      <div className="mt-4 flex w-full justify-between">
        {!isFirstQuestion && (
          <BackButton
            onClick={() => {
              if (otherSpecified.length > 0 && showOther) {
                selectedChoices.push(otherSpecified);
              }
              onBack({
                [question.id]: selectedChoices,
              });
              resetForm();
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
