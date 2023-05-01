import { h } from "preact";
import { useState } from "preact/hooks";
import { cn } from "../lib/utils";
import type { RatingQuestion } from "../../../types/questions";
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
      <div className="fb-my-4">
        <fieldset>
          <legend className="fb-sr-only">Choices</legend>
          <div className="fb-flex">
            {Array.from({ length: question.range }, (_, i) => i + 1).map((number) =>
              question.scale === "number" ? (
                <label
                  key={number}
                  className={cn(
                    selectedChoice === number ? "fb-z-10 fb-border-slate-400 fb-bg-slate-50" : "",
                    "fb-relative fb-h-10 fb-flex-1 fb-cursor-pointer fb-border fb-bg-white fb-text-center fb-text-sm fb-leading-10 first:fb-rounded-l-md last:fb-rounded-r-md hover:fb-bg-gray-100 focus:fb-outline-none"
                  )}>
                  <input
                    type="radio"
                    name="nps"
                    value={number}
                    className="fb-absolute fb-h-full fb-w-full fb-cursor-pointer fb-opacity-0"
                    onChange={() => handleSelect(number)}
                    required={question.required}
                  />
                  {number}
                </label>
              ) : (
                <label
                  key={number}
                  className="fb-relative fb-flex fb-max-h-10 fb-flex-1 fb-cursor-pointer fb-justify-center fb-bg-white fb-text-center fb-text-sm fb-leading-10 hover:fb-text-yellow-300">
                  <input
                    type="radio"
                    name="rating"
                    value={number}
                    className="fb-absolute fb-h-full fb-w-full fb-cursor-pointer fb-opacity-0"
                    onChange={() => handleSelect(number)}
                    required={question.required}
                  />
                  {selectedChoice && selectedChoice >= number ? (
                    // <FilledStarIcon className="max-h-full text-yellow-300" />
                    <span className="fb-text-yellow-300">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                        className="fb-max-h-full fb-h-6 fb-w-6 ">
                        <path
                          fillRule="evenodd"
                          d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.007 5.404.433c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.433 2.082-5.006z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </span>
                  ) : (
                    // <StarIcon className="max-h-full " />
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke-width="1.5"
                      stroke="currentColor"
                      className="fb-h-6 fb-max-h-full fb-w-6">
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z"
                      />
                    </svg>
                  )}
                </label>
              )
            )}
          </div>
          <div className="fb-flex fb-justify-between fb-text-slate-500  fb-leading-6 fb-px-1.5 fb-text-xs">
            <p>{question.lowerLabel}</p>
            <p>{question.upperLabel}</p>
          </div>
        </fieldset>
      </div>
      {!question.required && (
        <div className="fb-mt-4 fb-flex fb-w-full fb-justify-between">
          <div></div>
          <button
            type="submit"
            className="fb-flex fb-items-center fb-rounded-md fb-border fb-border-transparent fb-px-3 fb-py-3 fb-text-base fb-font-medium fb-leading-4 fb-text-white fb-shadow-sm hover:fb-opacity-90 focus:fb-outline-none focus:fb-ring-2 focus:fb-ring-slate-500 focus:fb-ring-offset-2"
            style={{ backgroundColor: brandColor }}>
            {question.buttonLabel || (lastQuestion ? "Finish" : "Next")}
          </button>
        </div>
      )}
    </form>
  );
}
