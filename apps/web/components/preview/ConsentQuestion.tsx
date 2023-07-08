import type { ConsentQuestion } from "@formbricks/types/questions";
import Headline from "./Headline";
import HtmlBody from "./HtmlBody";
import { cn } from "@/../../packages/lib/cn";
import { isLight } from "@/lib/utils";
import { useState } from "react";

interface ConsentQuestionProps {
  question: ConsentQuestion;
  onSubmit: (data: { [x: string]: any }) => void;
  lastQuestion: boolean;
  brandColor: string;
  savedAnswer: string | null;
  goToNextQuestion: () => void;
}

export default function ConsentQuestion({
  question,
  onSubmit,
  lastQuestion,
  brandColor,
  savedAnswer,
  goToNextQuestion,
}: ConsentQuestionProps) {
  const [answer, setAnswer] = useState<string>(savedAnswer ?? "dismissed");

  const handleOnChange = () => {
    answer === "accepted" ? setAnswer("dissmissed") : setAnswer("accepted");
  };

  const handleSumbit = (value: string) => {
    if (savedAnswer === value) {
      goToNextQuestion();
      return;
    }
    const data = {
      [question.id]: value,
    };
    onSubmit(data);
  };

  return (
    <div>
      <Headline headline={question.headline} questionId={question.id} />
      <HtmlBody htmlString={question.html || ""} questionId={question.id} />
      console.log(question.label)
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

        <div className="mt-4 flex w-full justify-end">
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
