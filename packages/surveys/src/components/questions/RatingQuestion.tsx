import { BackButton } from "@/components/buttons/BackButton";
import SubmitButton from "@/components/buttons/SubmitButton";
import QuestionImage from "@/components/general/QuestionImage";
import Headline from "@/components/general/Headline";
import { cn, getLocalizedValue } from "@/lib/utils";
import { TResponseData } from "@formbricks/types/responses";
import type { TSurveyRatingQuestion } from "@formbricks/types/surveys";
import { useState } from "preact/hooks";
import {
  ConfusedFace,
  FrowningFace,
  GrinningFaceWithSmilingEyes,
  GrinningSquintingFace,
  NeutralFace,
  PerseveringFace,
  SlightlySmilingFace,
  SmilingFaceWithSmilingEyes,
  TiredFace,
  WearyFace,
} from "../general/Smileys";
import Subheader from "../general/Subheader";

interface RatingQuestionProps {
  question: TSurveyRatingQuestion;
  value: string | number | string[];
  onChange: (responseData: TResponseData) => void;
  onSubmit: (data: TResponseData) => void;
  onBack: () => void;
  isFirstQuestion: boolean;
  isLastQuestion: boolean;
  language: string;
}

export default function RatingQuestion({
  question,
  value,
  onChange,
  onSubmit,
  onBack,
  isFirstQuestion,
  isLastQuestion,
  language,
}: RatingQuestionProps) {
  const [hoveredNumber, setHoveredNumber] = useState(0);

  const handleSelect = (number: number) => {
    onChange({ [question.id]: number });
    if (question.required) {
      onSubmit({
        [question.id]: number,
      });
    }
  };

  const HiddenRadioInput = ({ number }: { number: number }) => (
    <input
      type="radio"
      name="rating"
      value={number}
      className="absolute left-0 h-full w-full cursor-pointer opacity-0"
      onChange={() => handleSelect(number)}
      required={question.required}
      checked={value === number}
    />
  );

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({ [question.id]: value });
      }}
      className="w-full">
      {question.imageUrl && <QuestionImage imgUrl={question.imageUrl} />}
      <Headline
        headline={getLocalizedValue(question.headline, language)}
        questionId={question.id}
        required={question.required}
      />
      <Subheader
        subheader={question.subheader ? getLocalizedValue(question.subheader, language) : ""}
        questionId={question.id}
      />
      <div className="mb-4 mt-8">
        <fieldset>
          <legend className="sr-only">Choices</legend>
          <div className="flex">
            {Array.from({ length: question.range }, (_, i) => i + 1).map((number, i, a) => (
              <span
                key={number}
                onMouseOver={() => setHoveredNumber(number)}
                onMouseLeave={() => setHoveredNumber(0)}
                className="max-w-10 bg-survey-bg relative max-h-10 flex-1 cursor-pointer text-center text-sm leading-10">
                {question.scale === "number" ? (
                  <label
                    tabIndex={i + 1}
                    onKeyDown={(e) => {
                      if (e.key == "Enter") {
                        handleSelect(number);
                      }
                    }}
                    className={cn(
                      value === number ? "bg-accent-selected-bg border-border-highlight z-10" : "",
                      a.length === number ? "rounded-r-md" : "",
                      number === 1 ? "rounded-l-md" : "",
                      "text-heading hover:bg-accent-bg focus:bg-accent-bg block h-full w-full border focus:outline-none"
                    )}>
                    <HiddenRadioInput number={number} />
                    {number}
                  </label>
                ) : question.scale === "star" ? (
                  <label
                    tabIndex={i + 1}
                    onKeyDown={(e) => {
                      if (e.key == "Enter") {
                        handleSelect(number);
                      }
                    }}
                    className={cn(
                      number <= hoveredNumber ? "text-rating-focus" : "text-heading",
                      "focus:text-rating-focus flex h-full w-full justify-center focus:outline-none"
                    )}
                    onFocus={() => setHoveredNumber(number)}
                    onBlur={() => setHoveredNumber(0)}>
                    <HiddenRadioInput number={number} />
                    {typeof value === "number" && value >= number ? (
                      <span className="text-rating-fill">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 24 24"
                          fill="currentColor"
                          className="h-8 max-h-full w-8 ">
                          <path
                            fillRule="evenodd"
                            d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.007 5.404.433c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.433 2.082-5.006z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </span>
                    ) : (
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke-width="1.5"
                        stroke="currentColor"
                        className="h-8 max-h-full w-8">
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z"
                        />
                      </svg>
                    )}
                  </label>
                ) : (
                  <label
                    className={cn(
                      "flex h-full w-full justify-center",
                      value === number || hoveredNumber === number
                        ? "stroke-rating-selected text-rating-selected"
                        : "stroke-heading text-heading"
                    )}
                    tabIndex={i + 1}
                    onKeyDown={(e) => {
                      if (e.key == "Enter") {
                        handleSelect(number);
                      }
                    }}
                    onFocus={() => setHoveredNumber(number)}
                    onBlur={() => setHoveredNumber(0)}>
                    <HiddenRadioInput number={number} />
                    <RatingSmiley
                      active={value === number || hoveredNumber === number}
                      idx={i}
                      range={question.range}
                    />
                  </label>
                )}
              </span>
            ))}
          </div>
          <div className="text-subheading flex justify-between px-1.5 text-xs leading-6">
            <p className="w-1/2 text-left">{question.lowerLabel}</p>
            <p className="w-1/2 text-right">{question.upperLabel}</p>
          </div>
        </fieldset>
      </div>

      <div className="mt-4 flex w-full justify-between">
        {!isFirstQuestion && (
          <BackButton
            tabIndex={!question.required || value ? question.range + 2 : question.range + 1}
            backButtonLabel={question.backButtonLabel}
            onClick={() => {
              onBack();
            }}
          />
        )}
        <div></div>
        {(!question.required || value) && (
          <SubmitButton
            tabIndex={question.range + 1}
            buttonLabel={question.buttonLabel}
            isLastQuestion={isLastQuestion}
            onClick={() => {}}
          />
        )}
      </div>
    </form>
  );
}

interface RatingSmileyProps {
  active: boolean;
  idx: number;
  range: number;
}

function RatingSmiley({ active, idx, range }: RatingSmileyProps): JSX.Element {
  const activeColor = "fill-rating-fill";
  const inactiveColor = "fill-none";
  let icons = [
    <TiredFace className={active ? activeColor : inactiveColor} />,
    <WearyFace className={active ? activeColor : inactiveColor} />,
    <PerseveringFace className={active ? activeColor : inactiveColor} />,
    <FrowningFace className={active ? activeColor : inactiveColor} />,
    <ConfusedFace className={active ? activeColor : inactiveColor} />,
    <NeutralFace className={active ? activeColor : inactiveColor} />,
    <SlightlySmilingFace className={active ? activeColor : inactiveColor} />,
    <SmilingFaceWithSmilingEyes className={active ? activeColor : inactiveColor} />,
    <GrinningFaceWithSmilingEyes className={active ? activeColor : inactiveColor} />,
    <GrinningSquintingFace className={active ? activeColor : inactiveColor} />,
  ];

  if (range == 7) icons = [icons[1], icons[3], icons[4], icons[5], icons[6], icons[8], icons[9]];
  else if (range == 5) icons = [icons[3], icons[4], icons[5], icons[6], icons[7]];
  else if (range == 4) icons = [icons[4], icons[5], icons[6], icons[7]];
  else if (range == 3) icons = [icons[4], icons[5], icons[7]];
  return icons[idx];
}
