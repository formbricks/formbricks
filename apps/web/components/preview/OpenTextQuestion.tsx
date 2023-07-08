import type { OpenTextQuestion } from "@formbricks/types/questions";
import { useEffect, useState } from "react";
import Headline from "./Headline";
import Subheader from "./Subheader";
import SubmitButton from "@/components/preview/SubmitButton";
import { Button } from "@formbricks/ui";
import { Response } from "@formbricks/types/js";

interface OpenTextQuestionProps {
  question: OpenTextQuestion;
  onSubmit: (data: { [x: string]: any }) => void;
  lastQuestion: boolean;
  brandColor: string;
  savedAnswer: string | null;
  goToNextQuestion: () => void;
  goToPreviousQuestion?: (answer?: Response["data"]) => void;
}

export default function OpenTextQuestion({
  question,
  onSubmit,
  lastQuestion,
  brandColor,
  savedAnswer,
  goToNextQuestion,
  goToPreviousQuestion,
}: OpenTextQuestionProps) {
  const [value, setValue] = useState<string>("");

  useEffect(() => {
    setValue(savedAnswer ?? "");
  }, [savedAnswer, question]);

  const handleSubmit = (value: string) => {
    const data = {
      [question.id]: value,
    };
    onSubmit(data);
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();

        if (savedAnswer === value) {
          goToNextQuestion();
          setValue(""); // reset value
          return;
        }
        handleSubmit(value);
        setValue(""); // reset value
      }}>
      <Headline headline={question.headline} questionId={question.id} />
      <Subheader subheader={question.subheader} questionId={question.id} />
      <div className="mt-4">
        {question.longAnswer === false ? (
          <input
            autoFocus
            name={question.id}
            id={question.id}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={question.placeholder}
            required={question.required}
            className="block w-full rounded-md border border-slate-100 bg-slate-50 p-2 shadow-sm focus:border-slate-500 focus:outline-none focus:ring-0 sm:text-sm"
          />
        ) : (
          <textarea
            autoFocus
            rows={3}
            name={question.id}
            id={question.id}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={question.placeholder}
            required={question.required}
            className="block w-full rounded-md border border-slate-100 bg-slate-50 p-2 shadow-sm focus:border-slate-500 focus:ring-0 sm:text-sm"
          />
        )}
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
                savedAnswer !== value
                  ? {
                      [question.id]: value,
                    }
                  : undefined
              );
            }}>
            Back
          </Button>
        )}
        <div></div>
        <SubmitButton {...{ question, lastQuestion, brandColor, savedAnswer, goToNextQuestion }} />
      </div>
    </form>
  );
}
