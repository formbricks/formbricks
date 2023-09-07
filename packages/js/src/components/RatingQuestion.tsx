import { h } from "preact";
import { useEffect, useState } from "preact/hooks";
import { TResponseData } from "../../../types/v1/responses";
import type { TSurveyRatingQuestion } from "../../../types/v1/surveys";
import { cn } from "../lib/utils";
import Headline from "./Headline";
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
} from "./Smileys";
import Subheader from "./Subheader";
import SubmitButton from "./SubmitButton";
import { BackButton } from "./BackButton";

interface RatingQuestionProps {
  question: TSurveyRatingQuestion;
  onSubmit: (data: TResponseData) => void;
  lastQuestion: boolean;
  brandColor: string;
  storedResponseValue: number | null;
  goToNextQuestion: (answer: TResponseData) => void;
  goToPreviousQuestion?: (answer?: TResponseData) => void;
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

  useEffect(() => {
    setSelectedChoice(storedResponseValue);
  }, [storedResponseValue, question]);

  const handleSubmit = (value: number | null) => {
    const data = {
      [question.id]: value,
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
      onSubmit({
        [question.id]: number,
      });
      setSelectedChoice(null); // reset choice
    }
  };

  const HiddenRadioInput = ({ number }) => (
    <input
      type="radio"
      name="rating"
      value={number}
      className="fb-absolute fb-h-full fb-w-full fb-cursor-pointer fb-opacity-0 fb-left-0"
      onChange={() => handleSelect(number)}
      required={question.required}
      checked={selectedChoice === number}
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
      <div className="fb-my-4">
        <fieldset>
          <legend className="fb-sr-only">Choices</legend>
          <div className="fb-flex">
            {Array.from({ length: question.range }, (_, i) => i + 1).map((number, i, a) => (
              <span
                key={number}
                onMouseOver={() => setHoveredNumber(number)}
                onMouseLeave={() => setHoveredNumber(0)}
                className="fb-relative fb-max-h-10 fb-flex-1 fb-cursor-pointer fb-bg-white fb-text-center fb-text-sm fb-leading-10">
                {question.scale === "number" ? (
                  <label
                    className={cn(
                      selectedChoice === number ? "fb-z-10 fb-border-slate-400 fb-bg-slate-50" : "",
                      a.length === number ? "fb-rounded-r-md" : "",
                      number === 1 ? "fb-rounded-l-md" : "",
                      "fb-block fb-h-full fb-w-full fb-border hover:fb-bg-gray-100 focus:fb-outline-none fb-text-slate-800"
                    )}>
                    <HiddenRadioInput number={number} />
                    {number}
                  </label>
                ) : question.scale === "star" ? (
                  <label
                    className={cn(
                      number <= hoveredNumber ? "fb-text-yellow-500" : "",
                      "fb-flex fb-h-full fb-w-full fb-justify-center"
                    )}>
                    <HiddenRadioInput number={number} />
                    {selectedChoice && selectedChoice >= number ? (
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
                ) : (
                  <label className="fb-flex fb-h-full fb-w-full fb-justify-center fb-text-slate-800">
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
          <div className="fb-flex fb-justify-between fb-text-slate-500 fb-leading-6 fb-px-1.5 fb-text-xs">
            <p>{question.lowerLabel}</p>
            <p>{question.upperLabel}</p>
          </div>
        </fieldset>
      </div>

      <div className="fb-mt-4 fb-flex fb-w-full fb-justify-between">
        {goToPreviousQuestion && (
          <BackButton
            backButtonLabel={question.backButtonLabel}
            onClick={() => {
              goToPreviousQuestion({ [question.id]: selectedChoice });
            }}
          />
        )}
        <div></div>
        {(!question.required || selectedChoice) && (
          <SubmitButton
            question={question}
            lastQuestion={lastQuestion}
            brandColor={brandColor}
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
  const activeColor = "fb-fill-yellow-500";
  const inactiveColor = "fb-fill-none";
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
