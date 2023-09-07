import { useEffect, useState } from "react";
import { cn } from "@formbricks/lib/cn";
import type { RatingQuestion } from "@formbricks/types/questions";
import Headline from "./Headline";
import Subheader from "./Subheader";
import { StarIcon } from "@heroicons/react/24/outline";
import { StarIcon as FilledStarIcon } from "@heroicons/react/24/solid";
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
} from "../Smileys";
import SubmitButton from "@/components/preview/SubmitButton";

import { Response } from "@formbricks/types/js";
import { BackButton } from "@/components/preview/BackButton";
import { TSurveyRatingQuestion } from "@formbricks/types/v1/surveys";

interface RatingQuestionProps {
  question: RatingQuestion | TSurveyRatingQuestion;
  onSubmit: (data: { [x: string]: any }) => void;
  lastQuestion: boolean;
  brandColor: string;
  storedResponseValue: number | null;
  goToNextQuestion: (answer: Response["data"]) => void;
  goToPreviousQuestion?: (answer?: Response["data"]) => void;
}

export default function RatingQuestion({
  question,
  onSubmit,
  lastQuestion,
  brandColor,
  storedResponseValue,
  goToNextQuestion,
  goToPreviousQuestion,
}: RatingQuestionProps) {
  const [selectedChoice, setSelectedChoice] = useState<number | null>(null);
  const [hoveredNumber, setHoveredNumber] = useState(0);
  // const icons = RatingSmileyList(question.range);

  useEffect(() => {
    setSelectedChoice(storedResponseValue);
  }, [storedResponseValue, question]);

  const handleSubmit = (value: number | null) => {
    const data = {
      [question.id]: value ?? null,
    };
    if (storedResponseValue === value) {
      goToNextQuestion(data);
      setSelectedChoice(null);
      return;
    }
    onSubmit(data);
    setSelectedChoice(null);
  };

  const handleSelect = (number: number) => {
    setSelectedChoice(number);
    if (question.required) {
      handleSubmit(number);
    }
  };

  const HiddenRadioInput = ({ number }) => (
    <input
      type="radio"
      name="rating"
      value={number}
      className="absolute left-0 h-full w-full cursor-pointer opacity-0"
      onChange={() => handleSelect(number)}
      checked={selectedChoice === number}
      required={question.required}
    />
  );

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        handleSubmit(selectedChoice);
      }}>
      <Headline headline={question.headline} questionId={question.id} />
      <Subheader subheader={question.subheader} questionId={question.id} />
      <div className="my-4">
        <fieldset className="max-w-full">
          <legend className="sr-only">Options</legend>

          <div className="flex">
            {Array.from({ length: question.range }, (_, i) => i + 1).map((number, i, a) => (
              <span
                key={number}
                onMouseOver={() => setHoveredNumber(number)}
                onMouseLeave={() => setHoveredNumber(0)}
                className="relative max-h-10 flex-1 cursor-pointer bg-white text-center text-sm leading-10">
                {question.scale === "number" ? (
                  <label
                    className={cn(
                      selectedChoice === number ? "z-10 border-slate-400 bg-slate-50" : "",
                      a.length === number ? "rounded-r-md" : "",
                      number === 1 ? "rounded-l-md" : "",
                      "box-border block h-full w-full border hover:bg-gray-100 focus:outline-none"
                    )}>
                    <HiddenRadioInput number={number} />
                    {number}
                  </label>
                ) : question.scale === "star" ? (
                  <label
                    className={cn(
                      number <= hoveredNumber ? "text-yellow-500" : "",
                      "flex h-full w-full justify-center"
                    )}>
                    <HiddenRadioInput number={number} />
                    {selectedChoice && selectedChoice >= number ? (
                      <FilledStarIcon className="max-h-full text-yellow-300" />
                    ) : (
                      <StarIcon className="max-h-full " />
                    )}
                  </label>
                ) : (
                  <label className="flex h-full w-full justify-center">
                    <HiddenRadioInput number={number} />
                    <RatingSmiley
                      active={selectedChoice == number || hoveredNumber == number}
                      idx={i}
                      range={question.range}
                    />
                  </label>
                )}
              </span>
            ))}
          </div>

          <div className="flex justify-between px-1.5 text-xs leading-6 text-slate-500">
            <p>{question.lowerLabel}</p>
            <p>{question.upperLabel}</p>
          </div>
        </fieldset>
      </div>

      <div className="mt-4 flex w-full justify-between">
        {goToPreviousQuestion && (
          <BackButton
            backButtonLabel={question.backButtonLabel}
            onClick={() => {
              goToPreviousQuestion({ [question.id]: selectedChoice });
            }}
          />
        )}
        <div></div>
        {(!question.required || storedResponseValue) && (
          <SubmitButton {...{ question, lastQuestion, brandColor }} />
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
  const activeColor = "fill-yellow-500";
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
