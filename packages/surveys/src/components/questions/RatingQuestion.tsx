import { BackButton } from "@/components/buttons/BackButton";
import { SubmitButton } from "@/components/buttons/SubmitButton";
import { Headline } from "@/components/general/Headline";
import { QuestionMedia } from "@/components/general/QuestionMedia";
import { ScrollableContainer } from "@/components/wrappers/ScrollableContainer";
import { getUpdatedTtc, useTtc } from "@/lib/ttc";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "preact/hooks";
import { getLocalizedValue } from "@formbricks/lib/i18n/utils";
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
import { Subheader } from "../general/Subheader";

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
  currentQuestionId: string;
}

export const RatingQuestion = ({
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
}: RatingQuestionProps) => {
  const [hoveredNumber, setHoveredNumber] = useState(0);
  const [startTime, setStartTime] = useState(performance.now());
  const isMediaAvailable = question.imageUrl || question.videoUrl;

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

  const HiddenRadioInput = ({ number, id }: { number: number; id?: string }) => (
    <input
      type="radio"
      id={id}
      name="rating"
      value={number}
      className="invisible absolute left-0 h-full w-full cursor-pointer opacity-0"
      onClick={() => handleSelect(number)}
      required={question.required}
      checked={value === number}
    />
  );

  useEffect(() => {
    setHoveredNumber(0);
  }, [question.id, setHoveredNumber]);

  const getRatingNumberOptionColor = (range: number, idx: number) => {
    if (range > 5) {
      return range - idx < 2 ? "bg-emerald-100" : range - idx < 3 ? "bg-orange-100" : "bg-rose-100";
    } else {
      return range - idx < 1 ? "bg-emerald-100" : range - idx < 2 ? "bg-orange-100" : "bg-rose-100";
    }
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
      className="w-full">
      <ScrollableContainer>
        <div>
          {isMediaAvailable && <QuestionMedia imgUrl={question.imageUrl} videoUrl={question.videoUrl} />}
          <Headline
            headline={getLocalizedValue(question.headline, languageCode)}
            questionId={question.id}
            required={question.required}
          />
          <Subheader
            subheader={question.subheader ? getLocalizedValue(question.subheader, languageCode) : ""}
            questionId={question.id}
          />
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
                          // Accessibility: if spacebar was pressed pass this down to the input
                          if (e.key === " ") {
                            e.preventDefault();
                            document.getElementById(number.toString())?.click();
                            document.getElementById(number.toString())?.focus();
                          }
                        }}
                        className={cn(
                          value === number
                            ? "bg-accent-selected-bg border-border-highlight z-10 border"
                            : "border-border",
                          a.length === number ? "rounded-r-custom border-r" : "",
                          number === 1 ? "rounded-l-custom" : "",
                          hoveredNumber === number ? "bg-accent-bg" : "",
                          "text-heading focus:border-brand relative flex min-h-[41px] w-full cursor-pointer items-center justify-center overflow-hidden border-b border-l border-t focus:border-2 focus:outline-none"
                        )}>
                        {question.addColorCoding && (
                          <div
                            className={`absolute left-0 top-0 h-[6px] w-full ${getRatingNumberOptionColor(question.range, number)}`}
                          />
                        )}
                        <HiddenRadioInput number={number} id={number.toString()} />
                        {number}
                      </label>
                    ) : question.scale === "star" ? (
                      <label
                        tabIndex={i + 1}
                        onKeyDown={(e) => {
                          // Accessibility: if spacebar was pressed pass this down to the input
                          if (e.key === " ") {
                            e.preventDefault();
                            document.getElementById(number.toString())?.click();
                            document.getElementById(number.toString())?.focus();
                          }
                        }}
                        className={cn(
                          number <= hoveredNumber || number <= (value as number)
                            ? "text-amber-400"
                            : "text-[#8696AC]",
                          hoveredNumber === number ? "text-amber-400" : "",
                          "relative flex max-h-16 min-h-9 cursor-pointer justify-center focus:outline-none"
                        )}
                        onFocus={() => setHoveredNumber(number)}
                        onBlur={() => setHoveredNumber(0)}>
                        <HiddenRadioInput number={number} id={number.toString()} />
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
                            : "stroke-heading text-heading focus:border-accent-bg focus:border-2 focus:outline-none"
                        )}
                        tabIndex={i + 1}
                        onKeyDown={(e) => {
                          // Accessibility: if spacebar was pressed pass this down to the input
                          if (e.key === " ") {
                            e.preventDefault();
                            document.getElementById(number.toString())?.click();
                            document.getElementById(number.toString())?.focus();
                          }
                        }}
                        onFocus={() => setHoveredNumber(number)}
                        onBlur={() => setHoveredNumber(0)}>
                        <HiddenRadioInput number={number} id={number.toString()} />
                        <div className="h-full w-full max-w-[74px] object-contain">
                          <RatingSmiley
                            active={value === number || hoveredNumber === number}
                            idx={i}
                            range={question.range}
                            addColors={question.addColorCoding}
                          />
                        </div>
                      </label>
                    )}
                  </span>
                ))}
              </div>
              <div className="text-subheading mt-4 flex justify-between px-1.5 text-xs leading-6">
                <p className="w-1/2 text-left" dir="auto">
                  {getLocalizedValue(question.lowerLabel, languageCode)}
                </p>
                <p className="w-1/2 text-right" dir="auto">
                  {getLocalizedValue(question.upperLabel, languageCode)}
                </p>
              </div>
            </fieldset>
          </div>
        </div>
      </ScrollableContainer>
      <div className="flex w-full justify-between px-6 py-4">
        {!isFirstQuestion && (
          <BackButton
            tabIndex={!question.required || value ? question.range + 2 : question.range + 1}
            backButtonLabel={getLocalizedValue(question.backButtonLabel, languageCode)}
            onClick={() => {
              const updatedTtcObj = getUpdatedTtc(ttc, question.id, performance.now() - startTime);
              setTtc(updatedTtcObj);
              onBack();
            }}
          />
        )}
        <div></div>
        {!question.required && (
          <SubmitButton
            tabIndex={question.range + 1}
            buttonLabel={getLocalizedValue(question.buttonLabel, languageCode)}
            isLastQuestion={isLastQuestion}
          />
        )}
      </div>
    </form>
  );
};

interface RatingSmileyProps {
  active: boolean;
  idx: number;
  range: number;
  addColors?: boolean;
}

const colors = [
  "fill-[#FF0000]",
  "fill-[#FF3300]",
  "fill-[#FF6600]",
  "fill-[#FF9900]",
  "fill-[#FFCC00]",
  "fill-[#FFFF00]",
  "fill-[#CCFF00]",
  "fill-[#99FF00]",
  "fill-[#66FF00]",
  "fill-[#33FF00]",
];

const RatingSmiley = ({ active, idx, range, addColors }: RatingSmileyProps): JSX.Element => {
  const activeColor = "fill-rating-fill";
  const getInactiveColor = (idx: number) => {
    return addColors ? colors[idx] : "fill-none";
  };

  let icons = [
    <TiredFace className={active ? activeColor : getInactiveColor(0)} />,
    <WearyFace className={active ? activeColor : getInactiveColor(1)} />,
    <PerseveringFace className={active ? activeColor : getInactiveColor(2)} />,
    <FrowningFace className={active ? activeColor : getInactiveColor(3)} />,
    <ConfusedFace className={active ? activeColor : getInactiveColor(4)} />,
    <NeutralFace className={active ? activeColor : getInactiveColor(5)} />,
    <SlightlySmilingFace className={active ? activeColor : getInactiveColor(6)} />,
    <SmilingFaceWithSmilingEyes className={active ? activeColor : getInactiveColor(7)} />,
    <GrinningFaceWithSmilingEyes className={active ? activeColor : getInactiveColor(8)} />,
    <GrinningSquintingFace className={active ? activeColor : getInactiveColor(9)} />,
  ];

  if (range == 7) icons = [icons[1], icons[3], icons[4], icons[5], icons[6], icons[8], icons[9]];
  else if (range == 5) icons = [icons[3], icons[4], icons[5], icons[6], icons[7]];
  else if (range == 4) icons = [icons[4], icons[5], icons[6], icons[7]];
  else if (range == 3) icons = [icons[4], icons[5], icons[7]];
  return icons[idx];
};
