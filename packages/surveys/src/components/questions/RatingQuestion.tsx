import { BackButton } from "@/components/buttons/BackButton";
import SubmitButton from "@/components/buttons/SubmitButton";
import Headline from "@/components/general/Headline";
import QuestionImage from "@/components/general/QuestionImage";
import { getUpdatedTtc, useTtc } from "@/lib/ttc";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "preact/hooks";

import { TResponseData, TResponseTtc } from "@formbricks/types/responses";
import type { TSurveyRatingQuestion } from "@formbricks/types/surveys";

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
  onSubmit: (data: TResponseData, ttc: TResponseTtc) => void;
  onBack: () => void;
  isFirstQuestion: boolean;
  isLastQuestion: boolean;
  ttc: TResponseTtc;
  setTtc: (ttc: TResponseTtc) => void;
}

export default function RatingQuestion({
  question,
  value,
  onChange,
  onSubmit,
  onBack,
  isFirstQuestion,
  isLastQuestion,
  ttc,
  setTtc,
}: RatingQuestionProps) {
  const [hoveredNumber, setHoveredNumber] = useState(0);
  const [startTime, setStartTime] = useState(performance.now());

  useTtc(question.id, ttc, setTtc, startTime, setStartTime);

  const handleSelect = (number: number) => {
    onChange({ [question.id]: number });
    if (question.required) {
      const updatedTtcObj = getUpdatedTtc(ttc, question.id, performance.now() - startTime);
      setTtc(updatedTtcObj);
      onSubmit(
        {
          [question.id]: number,
        },
        updatedTtcObj
      );
    }
  };

  const HiddenRadioInput = ({ number }: { number: number }) => (
    <input
      type="radio"
      name="rating"
      value={number}
      className="invisible absolute left-0 h-full w-full cursor-pointer opacity-0"
      onChange={() => handleSelect(number)}
      required={question.required}
      checked={value === number}
    />
  );

  useEffect(() => {
    setHoveredNumber(0);
  }, [question.id, setHoveredNumber]);

  return (
    <form
      key={question.id}
      onSubmit={(e) => {
        e.preventDefault();
        const updatedTtcObj = getUpdatedTtc(ttc, question.id, performance.now() - startTime);
        setTtc(updatedTtcObj);
        onSubmit({ [question.id]: value }, updatedTtcObj);
      }}
      className="w-full">
      {question.imageUrl && <QuestionImage imgUrl={question.imageUrl} />}
      <Headline headline={question.headline} questionId={question.id} required={question.required} />
      <Subheader subheader={question.subheader} questionId={question.id} />
      <div className="mb-4 mt-6 flex items-center justify-center">
        <fieldset className="w-full">
          <legend className="sr-only">Choices</legend>
          <div className="flex w-full">
            {Array.from({ length: question.range }, (_, i) => i + 1).map((number, i, a) => (
              <span
                key={number}
                onMouseOver={() => setHoveredNumber(number)}
                onMouseLeave={() => setHoveredNumber(0)}
                className="bg-survey-bg flex-1 text-center text-sm">
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
                      hoveredNumber === number ? "bg-accent-bg " : "",
                      "text-heading focus:bg-accent-bg relative flex min-h-[41px] w-full cursor-pointer items-center justify-center border focus:outline-none"
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
                      "relative flex max-h-16 min-h-9 cursor-pointer justify-center focus:outline-none",
                      number <= hoveredNumber || number <= (value as number)
                        ? "text-amber-400"
                        : "text-slate-300",
                      hoveredNumber === number ? "text-amber-400 " : ""
                    )}
                    onFocus={() => setHoveredNumber(number)}
                    onBlur={() => setHoveredNumber(0)}>
                    <HiddenRadioInput number={number} />
                    <div className="h-full w-full max-w-[74px] object-contain">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                        <path
                          fillRule="evenodd"
                          d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z"
                        />
                      </svg>
                    </div>
                  </label>
                ) : (
                  <label
                    className={cn(
                      "relative flex max-h-16 min-h-9 w-full cursor-pointer justify-center",
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
                    <div className="h-full w-full max-w-[74px] object-contain">
                      <RatingSmiley
                        active={value === number || hoveredNumber === number}
                        idx={i}
                        range={question.range}
                      />
                    </div>
                  </label>
                )}
              </span>
            ))}
          </div>
          <div className="text-subheading mt-4 flex justify-between px-1.5 text-xs leading-6">
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
              const updatedTtcObj = getUpdatedTtc(ttc, question.id, performance.now() - startTime);
              setTtc(updatedTtcObj);
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
