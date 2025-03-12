import { BackButton } from "@/components/buttons/back-button";
import { SubmitButton } from "@/components/buttons/submit-button";
import { Headline } from "@/components/general/headline";
import { QuestionMedia } from "@/components/general/question-media";
import { ScrollableContainer } from "@/components/wrappers/scrollable-container";
import { getLocalizedValue } from "@/lib/i18n";
import { getUpdatedTtc, useTtc } from "@/lib/ttc";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "preact/hooks";
import type { JSX } from "react";
import { type TResponseData, type TResponseTtc } from "@formbricks/types/responses";
import type { TSurveyQuestionId, TSurveyRatingQuestion } from "@formbricks/types/surveys/types";
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
} from "../general/smileys";
import { Subheader } from "../general/subheader";

interface RatingQuestionProps {
  question: TSurveyRatingQuestion;
  value?: number;
  onChange: (responseData: TResponseData) => void;
  onSubmit: (data: TResponseData, ttc: TResponseTtc) => void;
  onBack: () => void;
  isFirstQuestion: boolean;
  isLastQuestion: boolean;
  languageCode: string;
  ttc: TResponseTtc;
  setTtc: (ttc: TResponseTtc) => void;
  autoFocusEnabled: boolean;
  currentQuestionId: TSurveyQuestionId;
  isBackButtonHidden: boolean;
}

export function RatingQuestion({
  question,
  value,
  onChange,
  onSubmit,
  onBack,
  isFirstQuestion,
  isLastQuestion,
  languageCode,
  ttc,
  setTtc,
  currentQuestionId,
  isBackButtonHidden,
}: RatingQuestionProps) {
  const [hoveredNumber, setHoveredNumber] = useState(0);
  const [startTime, setStartTime] = useState(performance.now());
  const isMediaAvailable = question.imageUrl || question.videoUrl;
  const isCurrent = question.id === currentQuestionId;
  useTtc(question.id, ttc, setTtc, startTime, setStartTime, question.id === currentQuestionId);

  const handleSelect = (number: number) => {
    onChange({ [question.id]: number });
    const updatedTtcObj = getUpdatedTtc(ttc, question.id, performance.now() - startTime);
    setTtc(updatedTtcObj);
    setTimeout(() => {
      onSubmit(
        {
          [question.id]: number,
        },
        updatedTtcObj
      );
    }, 250);
  };

  function HiddenRadioInput({ number, id }: { number: number; id?: string }) {
    return (
      <input
        type="radio"
        id={id}
        name="rating"
        value={number}
        className="fb-invisible fb-absolute fb-left-0 fb-h-full fb-w-full fb-cursor-pointer fb-opacity-0"
        onClick={() => {
          handleSelect(number);
        }}
        required={question.required}
        checked={value === number}
      />
    );
  }

  useEffect(() => {
    setHoveredNumber(0);
  }, [question.id, setHoveredNumber]);

  const getRatingNumberOptionColor = (range: number, idx: number) => {
    if (range > 5) {
      if (range - idx < 2) return "fb-bg-emerald-100";
      if (range - idx < 4) return "fb-bg-orange-100";
      return "fb-bg-rose-100";
    } else if (range < 5) {
      if (range - idx < 1) return "fb-bg-emerald-100";
      if (range - idx < 2) return "fb-bg-orange-100";
      return "fb-bg-rose-100";
    }
    if (range - idx < 2) return "fb-bg-emerald-100";
    if (range - idx < 3) return "fb-bg-orange-100";
    return "fb-bg-rose-100";
  };

  return (
    <form
      key={question.id}
      onSubmit={(e) => {
        e.preventDefault();
        const updatedTtcObj = getUpdatedTtc(ttc, question.id, performance.now() - startTime);
        setTtc(updatedTtcObj);
        onSubmit({ [question.id]: value ?? "" }, updatedTtcObj);
      }}
      className="fb-w-full">
      <ScrollableContainer>
        <div>
          {isMediaAvailable ? (
            <QuestionMedia imgUrl={question.imageUrl} videoUrl={question.videoUrl} />
          ) : null}
          <Headline
            headline={getLocalizedValue(question.headline, languageCode)}
            questionId={question.id}
            required={question.required}
          />
          <Subheader
            subheader={question.subheader ? getLocalizedValue(question.subheader, languageCode) : ""}
            questionId={question.id}
          />
          <div className="fb-mb-4 fb-mt-6 fb-flex fb-items-center fb-justify-center">
            <fieldset className="fb-w-full">
              <legend className="fb-sr-only">Choices</legend>
              <div className="fb-flex fb-w-full">
                {Array.from({ length: question.range }, (_, i) => i + 1).map((number, i, a) => (
                  <span
                    key={number}
                    onMouseOver={() => {
                      setHoveredNumber(number);
                    }}
                    onMouseLeave={() => {
                      setHoveredNumber(0);
                    }}
                    className="fb-bg-survey-bg fb-flex-1 fb-text-center fb-text-sm">
                    {question.scale === "number" ? (
                      <label
                        tabIndex={isCurrent ? 0 : -1}
                        onKeyDown={(e) => {
                          // Accessibility: if spacebar was pressed pass this down to the input
                          if (e.key === " ") {
                            e.preventDefault();
                            document.getElementById(number.toString())?.click();
                            document.getElementById(number.toString())?.focus();
                          }
                        }}
                        className={cn(
                          value === number
                            ? "fb-bg-accent-selected-bg fb-border-border-highlight fb-z-10 fb-border"
                            : "fb-border-border",
                          a.length === number ? "fb-rounded-r-custom fb-border-r" : "",
                          number === 1 ? "fb-rounded-l-custom" : "",
                          hoveredNumber === number ? "fb-bg-accent-bg" : "",
                          question.isColorCodingEnabled ? "fb-min-h-[47px]" : "fb-min-h-[41px]",
                          "fb-text-heading focus:fb-border-brand fb-relative fb-flex fb-w-full fb-cursor-pointer fb-items-center fb-justify-center fb-overflow-hidden fb-border-b fb-border-l fb-border-t focus:fb-border-2 focus:fb-outline-none"
                        )}>
                        {question.isColorCodingEnabled ? (
                          <div
                            className={`fb-absolute fb-left-0 fb-top-0 fb-h-[6px] fb-w-full ${getRatingNumberOptionColor(question.range, number)}`}
                          />
                        ) : null}
                        <HiddenRadioInput number={number} id={number.toString()} />
                        {number}
                      </label>
                    ) : question.scale === "star" ? (
                      <label
                        tabIndex={isCurrent ? 0 : -1}
                        onKeyDown={(e) => {
                          // Accessibility: if spacebar was pressed pass this down to the input
                          if (e.key === " ") {
                            e.preventDefault();
                            document.getElementById(number.toString())?.click();
                            document.getElementById(number.toString())?.focus();
                          }
                        }}
                        className={cn(
                          number <= hoveredNumber || number <= value!
                            ? "fb-text-amber-400"
                            : "fb-text-[#8696AC]",
                          hoveredNumber === number ? "fb-text-amber-400" : "",
                          "fb-relative fb-flex fb-max-h-16 fb-min-h-9 fb-cursor-pointer fb-justify-center focus:fb-outline-none"
                        )}
                        onFocus={() => {
                          setHoveredNumber(number);
                        }}
                        onBlur={() => {
                          setHoveredNumber(0);
                        }}>
                        <HiddenRadioInput number={number} id={number.toString()} />
                        <div className="fb-h-full fb-w-full fb-max-w-[74px] fb-object-contain">
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
                        tabIndex={isCurrent ? 0 : -1}
                        className={cn(
                          "fb-relative fb-flex fb-max-h-16 fb-min-h-9 fb-w-full fb-cursor-pointer fb-justify-center",
                          value === number || hoveredNumber === number
                            ? "fb-stroke-rating-selected fb-text-rating-selected"
                            : "fb-stroke-heading fb-text-heading focus:fb-border-accent-bg focus:fb-border-2 focus:fb-outline-none"
                        )}
                        onKeyDown={(e) => {
                          // Accessibility: if spacebar was pressed pass this down to the input
                          if (e.key === " ") {
                            e.preventDefault();
                            document.getElementById(number.toString())?.click();
                            document.getElementById(number.toString())?.focus();
                          }
                        }}
                        onFocus={() => {
                          setHoveredNumber(number);
                        }}
                        onBlur={() => {
                          setHoveredNumber(0);
                        }}>
                        <HiddenRadioInput number={number} id={number.toString()} />
                        <div className={cn("fb-h-full fb-w-full fb-max-w-[74px] fb-object-contain")}>
                          <RatingSmiley
                            active={value === number || hoveredNumber === number}
                            idx={i}
                            range={question.range}
                            addColors={question.isColorCodingEnabled}
                          />
                        </div>
                      </label>
                    )}
                  </span>
                ))}
              </div>
              <div className="fb-text-subheading fb-mt-4 fb-flex fb-justify-between fb-px-1.5 fb-text-xs fb-leading-6 fb-space-x-8">
                <p className="fb-w-1/2 fb-text-left" dir="auto">
                  {getLocalizedValue(question.lowerLabel, languageCode)}
                </p>
                <p className="fb-w-1/2 fb-text-right" dir="auto">
                  {getLocalizedValue(question.upperLabel, languageCode)}
                </p>
              </div>
            </fieldset>
          </div>
        </div>
      </ScrollableContainer>
      <div className="fb-flex fb-flex-row-reverse fb-w-full fb-justify-between fb-px-6 fb-py-4">
        {question.required ? (
          <div></div>
        ) : (
          <SubmitButton
            tabIndex={isCurrent ? 0 : -1}
            buttonLabel={getLocalizedValue(question.buttonLabel, languageCode)}
            isLastQuestion={isLastQuestion}
          />
        )}
        <div />
        {!isFirstQuestion && !isBackButtonHidden && (
          <BackButton
            tabIndex={isCurrent ? 0 : -1}
            backButtonLabel={getLocalizedValue(question.backButtonLabel, languageCode)}
            onClick={() => {
              const updatedTtcObj = getUpdatedTtc(ttc, question.id, performance.now() - startTime);
              setTtc(updatedTtcObj);
              onBack();
            }}
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
  addColors?: boolean;
}

const getSmileyColor = (range: number, idx: number) => {
  if (range > 5) {
    if (range - idx < 3) return "fb-fill-emerald-100";
    if (range - idx < 5) return "fb-fill-orange-100";
    return "fb-fill-rose-100";
  } else if (range < 5) {
    if (range - idx < 2) return "fb-fill-emerald-100";
    if (range - idx < 3) return "fb-fill-orange-100";
    return "fb-fill-rose-100";
  }
  if (range - idx < 3) return "fb-fill-emerald-100";
  if (range - idx < 4) return "fb-fill-orange-100";
  return "fb-fill-rose-100";
};

const getActiveSmileyColor = (range: number, idx: number) => {
  if (range > 5) {
    if (range - idx < 3) return "fb-fill-emerald-300";
    if (range - idx < 5) return "fb-fill-orange-300";
    return "fb-fill-rose-300";
  } else if (range < 5) {
    if (range - idx < 2) return "fb-fill-emerald-300";
    if (range - idx < 3) return "fb-fill-orange-300";
    return "fb-fill-rose-300";
  }
  if (range - idx < 3) return "fb-fill-emerald-300";
  if (range - idx < 4) return "fb-fill-orange-300";
  return "fb-fill-rose-300";
};

const getSmiley = (iconIdx: number, idx: number, range: number, active: boolean, addColors: boolean) => {
  const activeColor = addColors ? getActiveSmileyColor(range, idx) : "fb-fill-rating-fill";
  const inactiveColor = addColors ? getSmileyColor(range, idx) : "fb-fill-none";

  const icons = [
    <TiredFace key="tired-face" className={active ? activeColor : inactiveColor} />,
    <WearyFace key="weary-face" className={active ? activeColor : inactiveColor} />,
    <PerseveringFace key="persevering-face" className={active ? activeColor : inactiveColor} />,
    <FrowningFace key="frowning-face" className={active ? activeColor : inactiveColor} />,
    <ConfusedFace key="confused-face" className={active ? activeColor : inactiveColor} />,
    <NeutralFace key="neutral-face" className={active ? activeColor : inactiveColor} />,
    <SlightlySmilingFace key="slightly-smiling-face" className={active ? activeColor : inactiveColor} />,
    <SmilingFaceWithSmilingEyes
      key="smiling-face-with-smiling-eyes"
      className={active ? activeColor : inactiveColor}
    />,
    <GrinningFaceWithSmilingEyes
      key="grinning-face-with-smiling-eyes"
      className={active ? activeColor : inactiveColor}
    />,
    <GrinningSquintingFace key="grinning-squinting-face" className={active ? activeColor : inactiveColor} />,
  ];
  return icons[iconIdx];
};

export const RatingSmiley = ({ active, idx, range, addColors = false }: RatingSmileyProps): JSX.Element => {
  let iconsIdx: number[] = [];
  if (range === 10) iconsIdx = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
  else if (range === 7) iconsIdx = [1, 3, 4, 5, 6, 8, 9];
  else if (range === 5) iconsIdx = [3, 4, 5, 6, 7];
  else if (range === 4) iconsIdx = [4, 5, 6, 7];
  else if (range === 3) iconsIdx = [4, 5, 7];

  return getSmiley(iconsIdx[idx], idx, range, active, addColors);
};
