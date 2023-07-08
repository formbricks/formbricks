import { Button } from "@formbricks/ui";
import SubmitButton from "@/components/preview/SubmitButton";
import { cn } from "@formbricks/lib/cn";
import type { MultipleChoiceSingleQuestion } from "@formbricks/types/questions";
import { useEffect, useState } from "react";
import Headline from "./Headline";
import Subheader from "./Subheader";
import { Response } from "@formbricks/types/js";

interface MultipleChoiceSingleProps {
  question: MultipleChoiceSingleQuestion;
  onSubmit: (data: { [x: string]: any }) => void;
  lastQuestion: boolean;
  brandColor: string;
  savedAnswer: string | null;
  goToNextQuestion: () => void;
  goToPreviousQuestion?: (answer?: Response["data"]) => void;
}

export default function MultipleChoiceSingleQuestion({
  question,
  onSubmit,
  lastQuestion,
  brandColor,
  savedAnswer,
  goToNextQuestion,
  goToPreviousQuestion,
}: MultipleChoiceSingleProps) {
  const [selectedChoice, setSelectedChoice] = useState<string | null>(null);
  const savedAnswerValue = question.choices.find((choice) => choice.label === savedAnswer)?.id;

  useEffect(() => {
    setSelectedChoice(savedAnswerValue ?? null);
  }, [savedAnswerValue, question]);

  const handleSubmit = (value: string) => {
    const data = {
      [question.id]: value,
    };
    onSubmit(data);
  };

  /*   const [isIphone, setIsIphone] = useState(false);


  useEffect(() => {
    setIsIphone(/iPhone|iPad|iPod/.test(navigator.userAgent));
  }, []);
 */
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const value = e.currentTarget[question.id].value;
        if (value === savedAnswer) {
          goToNextQuestion();
          setSelectedChoice(null); // reset form
          return;
        }
        handleSubmit(value);
        setSelectedChoice(null); // reset form
      }}>
      <Headline headline={question.headline} questionId={question.id} />
      <Subheader subheader={question.subheader} questionId={question.id} />
      <div className="mt-4">
        <fieldset>
          <legend className="sr-only">Options</legend>
          <div className="xs:max-h-[41vh] relative max-h-[60vh] space-y-2 overflow-y-auto rounded-md py-0.5 pr-2">
            {question.choices &&
              question.choices.map((choice, idx) => (
                <label
                  key={choice.id}
                  className={cn(
                    selectedChoice === choice.label ? "z-10 border-slate-400 bg-slate-50" : "border-gray-200",
                    "relative mb-2 flex cursor-pointer flex-col rounded-md border p-4 hover:bg-slate-50 focus:outline-none"
                  )}>
                  <span className="flex items-center text-sm">
                    <input
                      type="radio"
                      id={choice.id}
                      name={question.id}
                      value={choice.label}
                      className="h-4 w-4 border border-gray-300 focus:ring-0 focus:ring-offset-0"
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
                </label>
              ))}
            {/*             {isIphone && question.choices.length > 5 && (
              <div className="z-50 -mt-8 h-8 bg-gradient-to-b from-transparent to-white"></div>
            )} */}
            {/*             {isIphone && question.choices.length > 5 && (
              <div className="z-50 -mt-8 h-8 bg-gradient-to-b from-transparent to-white"></div>
            )} */}
          </div>
        </fieldset>
      </div>
      <div className="mt-4 flex w-full justify-between">
        {goToPreviousQuestion && (
          <Button
            type="button"
            variant="secondary"
            className="px-3 py-3 text-base font-medium leading-4 focus:ring-offset-2"
            onClick={(e) => {
              e.preventDefault();
              goToPreviousQuestion(
                selectedChoice !== savedAnswerValue
                  ? {
                      [question.id]: question.choices.find((choice) => choice.id === selectedChoice)?.label,
                    }
                  : undefined
              );
            }}>
            Back
          </Button>
        )}
        <div></div>
        <SubmitButton {...{ question, lastQuestion, brandColor }} />
      </div>
    </form>
  );
}
