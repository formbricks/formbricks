import { useState } from "react";
import { cn } from "@formbricks/lib/cn";
import type { RatingQuestion } from "@formbricks/types/questions";
import Headline from "./Headline";
import Subheader from "./Subheader";
import { StarIcon } from "@heroicons/react/24/outline";
import { StarIcon as FilledStarIcon } from "@heroicons/react/24/solid";

interface RatingQuestionProps {
  question: RatingQuestion;
  onSubmit: (data: { [x: string]: any }) => void;
  lastQuestion: boolean;
  brandColor: string;
}

export default function RatingQuestion({
  question,
  onSubmit,
  lastQuestion,
  brandColor,
}: RatingQuestionProps) {
  const [selectedChoice, setSelectedChoice] = useState<number | null>(null);

  const handleSelect = (number: number) => {
    setSelectedChoice(number);
    if (question.required) {
      onSubmit({
        [question.id]: number,
      });
      setSelectedChoice(null); // reset choice
    }
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();

        const data = {
          [question.id]: selectedChoice,
        };

        setSelectedChoice(null); // reset choice

        onSubmit(data);
      }}>
      <Headline headline={question.headline} questionId={question.id} />
      <Subheader subheader={question.subheader} questionId={question.id} />
      <div className="my-4">
        <fieldset className="max-w-full">
          <legend className="sr-only">Options</legend>
          <div className="flex">
            {Array.from({ length: question.range }, (_, i) => i + 1).map((number) =>
              question.scale === "number" ? (
                <label
                  key={number}
                  className={cn(
                    selectedChoice === number ? "z-10 border-slate-400 bg-slate-50" : "",
                    "relative h-10 flex-1 cursor-pointer border bg-white text-center text-sm  leading-10 first:rounded-l-md last:rounded-r-md hover:bg-gray-100 focus:outline-none"
                  )}>
                  <input
                    type="radio"
                    name="rating"
                    value={number}
                    className="absolute h-full w-full cursor-pointer opacity-0"
                    onChange={() => handleSelect(number)}
                    required={question.required}
                  />
                  {number}
                </label>
              ) : (
                <label
                  key={number}
                  className="relative flex max-h-10 flex-1 cursor-pointer justify-center bg-white text-center text-sm leading-10 hover:text-yellow-300">
                  <input
                    type="radio"
                    name="rating"
                    value={number}
                    className="absolute h-full w-full cursor-pointer opacity-0"
                    onChange={() => handleSelect(number)}
                    required={question.required}
                  />
                  {selectedChoice && selectedChoice >= number ? (
                    <FilledStarIcon className="max-h-full text-yellow-300" />
                  ) : (
                    <StarIcon className="max-h-full " />
                  )}
                </label>
              )
            )}
          </div>
          <div className="flex justify-between px-1.5 text-xs leading-6 text-slate-500">
            <p>{question.lowerLabel}</p>
            <p>{question.upperLabel}</p>
          </div>
        </fieldset>
      </div>
      {!question.required && (
        <div className="mt-4 flex w-full justify-between">
          <div></div>
          <button
            type="submit"
            className="flex items-center rounded-md border border-transparent px-3 py-3 text-base font-medium leading-4 text-white shadow-sm hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2"
            style={{ backgroundColor: brandColor }}>
            {question.buttonLabel || (lastQuestion ? "Finish" : "Next")}
          </button>
        </div>
      )}
    </form>
  );
}
