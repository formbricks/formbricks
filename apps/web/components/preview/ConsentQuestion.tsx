import type { ConsentQuestion } from "@formbricks/types/questions";
import Headline from "./Headline";
import HtmlBody from "./HtmlBody";
import { cn } from "@/../../packages/lib/cn";
import { isLight } from "@/lib/utils";
import { useEffect, useState } from "react";
import { Button } from "@formbricks/ui";
import { Response } from "@formbricks/types/js";

interface ConsentQuestionProps {
  question: ConsentQuestion;
  onSubmit: (data: { [x: string]: any }) => void;
  lastQuestion: boolean;
  brandColor: string;
  savedAnswer: string | null;
  goToNextQuestion: (answer: Response["data"]) => void;
  goToPreviousQuestion?: (answer?: Response["data"]) => void;
}

export default function ConsentQuestion({
  question,
  onSubmit,
  lastQuestion,
  brandColor,
  savedAnswer,
  goToNextQuestion,
  goToPreviousQuestion,
}: ConsentQuestionProps) {
  const [answer, setAnswer] = useState<string>("dismissed");

  useEffect(() => {
    setAnswer(savedAnswer ?? "dismissed");
  }, [savedAnswer, question]);

  const handleOnChange = () => {
    answer === "accepted" ? setAnswer("dissmissed") : setAnswer("accepted");
  };

  const handleSumbit = (value: string) => {
    const data = {
      [question.id]: value,
    };
    if (savedAnswer === value) {
      goToNextQuestion(data);
      setAnswer("dismissed");

      return;
    }
    onSubmit(data);
    setAnswer("dismissed");
  };

  return (
    <div>
      <Headline headline={question.headline} questionId={question.id} />
      <HtmlBody htmlString={question.html || ""} questionId={question.id} />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSumbit(answer);
        }}>
        <label className="relative z-10 mt-4 flex w-full cursor-pointer items-center rounded-md border border-gray-200 bg-slate-50 p-4 text-sm focus:outline-none">
          <input
            type="checkbox"
            id={question.id}
            name={question.id}
            value={question.label}
            className="h-4 w-4 border border-slate-300 focus:ring-0 focus:ring-offset-0"
            aria-labelledby={`${question.id}-label`}
            onChange={handleOnChange}
            checked={answer === "accepted"}
            style={{ borderColor: brandColor, color: brandColor }}
            required={question.required}
          />
          <span id={`${question.id}-label`} className="ml-3 font-medium">
            {question.label}
          </span>
        </label>

        <div className="mt-4 flex w-full justify-between">
          {goToPreviousQuestion && (
            <Button
              type="button"
              variant="secondary"
              className="px-3 py-3 text-base font-medium leading-4 focus:ring-offset-2"
              onClick={(e) => {
                e.preventDefault();
                goToPreviousQuestion({
                  [question.id]: answer,
                });
              }}>
              Back
            </Button>
          )}
          <div></div>
          <button
            type="submit"
            className={cn(
              "flex items-center rounded-md border border-transparent px-3 py-3 text-base font-medium leading-4 shadow-sm hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2",
              isLight(brandColor) ? "text-black" : "text-white"
            )}
            style={{ backgroundColor: brandColor }}>
            {question.buttonLabel || (lastQuestion ? "Finish" : "Next")}
          </button>
        </div>
      </form>
    </div>
  );
}
