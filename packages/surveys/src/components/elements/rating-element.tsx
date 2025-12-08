import { useEffect, useState } from "preact/hooks";
import type { JSX } from "react";
import { type TResponseData, type TResponseTtc } from "@formbricks/types/responses";
import type { TSurveyRatingElement } from "@formbricks/types/surveys/elements";
import { ElementMedia } from "@/components/general/element-media";
import { Headline } from "@/components/general/headline";
import { getLocalizedValue } from "@/lib/i18n";
import { getUpdatedTtc, useTtc } from "@/lib/ttc";
import { cn } from "@/lib/utils";
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

interface RatingElementProps {
  element: TSurveyRatingElement;
  value?: number;
  onChange: (responseData: TResponseData) => void;
  languageCode: string;
  ttc: TResponseTtc;
  setTtc: (ttc: TResponseTtc) => void;
  autoFocusEnabled: boolean;
  currentElementId: string;
  dir?: "ltr" | "rtl" | "auto";
}

export function RatingElement({
  element,
  value,
  onChange,
  languageCode,
  ttc,
  setTtc,
  currentElementId,
  dir = "auto",
}: RatingElementProps) {
  const [hoveredNumber, setHoveredNumber] = useState(0);
  const [startTime, setStartTime] = useState(performance.now());
  const isMediaAvailable = element.imageUrl || element.videoUrl;
  useTtc(element.id, ttc, setTtc, startTime, setStartTime, element.id === currentElementId);

  const handleSelect = (number: number) => {
    onChange({ [element.id]: number });
    const updatedTtcObj = getUpdatedTtc(ttc, element.id, performance.now() - startTime);
    setTtc(updatedTtcObj);
  };

  useEffect(() => {
    setHoveredNumber(0);
  }, [element.id, setHoveredNumber]);

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

  const handleFormSubmit = (e: Event) => {
    e.preventDefault();
    const updatedTtcObj = getUpdatedTtc(ttc, element.id, performance.now() - startTime);
    setTtc(updatedTtcObj);
  };

  const handleMouseOver = (number: number) => () => {
    setHoveredNumber(number);
  };

  const handleMouseLeave = () => {
    setHoveredNumber(0);
  };

  const handleFocus = (number: number) => () => {
    setHoveredNumber(number);
  };

  const handleBlur = () => {
    setHoveredNumber(0);
  };

  const getNumberLabelClassName = (number: number, totalLength: number): string => {
    const isSelected = value === number;
    const isLast = totalLength === number;
    const isFirst = number === 1;
    const isHovered = hoveredNumber === number;

    return cn(
      isSelected
        ? "fb-bg-accent-selected-bg fb-border-border-highlight fb-z-10 fb-border"
        : "fb-border-border",
      isLast ? (dir === "rtl" ? "fb-rounded-l-custom fb-border-l" : "fb-rounded-r-custom fb-border-r") : "",
      isFirst ? (dir === "rtl" ? "fb-rounded-r-custom fb-border-r" : "fb-rounded-l-custom fb-border-l") : "",
      isHovered ? "fb-bg-accent-bg" : "",
      element.isColorCodingEnabled ? "fb-min-h-[47px]" : "fb-min-h-[41px]",
      "fb-text-heading focus:fb-border-brand fb-relative fb-flex fb-w-full fb-cursor-pointer fb-items-center fb-justify-center fb-overflow-hidden fb-border-b fb-border-l fb-border-t focus:fb-border-2 focus:fb-outline-none"
    );
  };

  const getStarLabelClassName = (number: number): string => {
    const isActive = number <= hoveredNumber || number <= (value ?? 0);
    const isHovered = hoveredNumber === number;

    return cn(
      isActive || isHovered ? "fb-text-amber-400" : "fb-text-[#8696AC]",
      "fb-relative fb-flex fb-max-h-16 fb-min-h-9 fb-cursor-pointer fb-justify-center focus:fb-outline-none"
    );
  };

  const getSmileyLabelClassName = (number: number): string => {
    const isActive = value === number || hoveredNumber === number;

    return cn(
      "fb-relative fb-flex fb-max-h-16 fb-min-h-9 fb-w-full fb-cursor-pointer fb-justify-center",
      isActive
        ? "fb-stroke-rating-selected fb-text-rating-selected"
        : "fb-stroke-heading fb-text-heading focus:fb-border-accent-bg focus:fb-border-2 focus:fb-outline-none"
    );
  };

  const getRatingInputId = (number: number) => `${element.id}-${number}`;

  const handleKeyDown = (number: number) => (e: KeyboardEvent) => {
    if (e.key === " ") {
      e.preventDefault();
      const inputId = getRatingInputId(number);
      document.getElementById(inputId)?.click();
      document.getElementById(inputId)?.focus();
    }
  };

  const renderNumberScale = (number: number, totalLength: number) => {
    return (
      <label
        tabIndex={0} // NOSONAR - needed for keyboard navigation through options
        onKeyDown={handleKeyDown(number)}
        className={getNumberLabelClassName(number, totalLength)}>
        {element.isColorCodingEnabled && (
          <div
            className={`fb-absolute fb-left-0 fb-top-0 fb-h-[6px] fb-w-full ${getRatingNumberOptionColor(element.range, number)}`}
          />
        )}
        <input
          type="radio"
          id={getRatingInputId(number)}
          name="rating"
          value={number}
          className="fb-absolute fb-left-0 fb-h-full fb-w-full fb-cursor-pointer fb-opacity-0"
          onClick={() => {
            handleSelect(number);
          }}
          required={element.required}
          checked={value === number}
          tabIndex={-1}
        />
        {number}
      </label>
    );
  };

  const renderStarScale = (number: number) => {
    return (
      <label
        aria-label={`Rate ${number} out of ${element.range}`}
        tabIndex={0} // NOSONAR - needed for keyboard navigation through options
        onKeyDown={handleKeyDown(number)}
        className={getStarLabelClassName(number)}
        onFocus={handleFocus(number)}
        onBlur={handleBlur}>
        <input
          type="radio"
          id={getRatingInputId(number)}
          name="rating"
          value={number}
          className="fb-absolute fb-left-0 fb-h-full fb-w-full fb-cursor-pointer fb-opacity-0"
          onClick={() => {
            handleSelect(number);
          }}
          required={element.required}
          checked={value === number}
          tabIndex={-1}
        />
        <div className="fb-h-full fb-w-full fb-max-w-[74px] fb-object-contain">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
            <path
              fillRule="evenodd"
              d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z"
            />
          </svg>
        </div>
      </label>
    );
  };

  const renderSmileyScale = (number: number, idx: number) => {
    return (
      <label
        aria-label={`Rate ${number} out of ${element.range}`}
        tabIndex={0} // NOSONAR - needed for keyboard navigation through options
        className={getSmileyLabelClassName(number)}
        onKeyDown={handleKeyDown(number)}
        onFocus={handleFocus(number)}
        onBlur={handleBlur}>
        <input
          type="radio"
          id={getRatingInputId(number)}
          name="rating"
          value={number}
          className="fb-absolute fb-left-0 fb-h-full fb-w-full fb-cursor-pointer fb-opacity-0"
          onClick={() => {
            handleSelect(number);
          }}
          required={element.required}
          checked={value === number}
          tabIndex={-1}
        />
        <div className="fb-h-full fb-w-full fb-max-w-[74px] fb-object-contain">
          <RatingSmiley
            active={value === number || hoveredNumber === number}
            idx={idx}
            range={element.range}
            addColors={element.isColorCodingEnabled}
          />
        </div>
      </label>
    );
  };

  const renderRatingOption = (number: number, idx: number, totalLength: number) => {
    return (
      <span
        key={number}
        onMouseOver={handleMouseOver(number)}
        onMouseLeave={handleMouseLeave}
        onFocus={handleFocus(number)}
        className="fb-bg-survey-bg fb-flex-1 fb-text-center fb-text-sm">
        {element.scale === "number" && renderNumberScale(number, totalLength)}
        {element.scale === "star" && renderStarScale(number)}
        {element.scale !== "number" && element.scale !== "star" && renderSmileyScale(number, idx)}
      </span>
    );
  };

  return (
    <form key={element.id} onSubmit={handleFormSubmit} className="fb-w-full">
      {isMediaAvailable && <ElementMedia imgUrl={element.imageUrl} videoUrl={element.videoUrl} />}
      <Headline
        headline={getLocalizedValue(element.headline, languageCode)}
        elementId={element.id}
        required={element.required}
      />
      <Subheader
        subheader={element.subheader ? getLocalizedValue(element.subheader, languageCode) : ""}
        elementId={element.id}
      />
      <div className="fb-mb-4 fb-mt-6 fb-flex fb-items-center fb-justify-center">
        <fieldset className="fb-w-full">
          <legend className="fb-sr-only">Choices</legend>
          <div className="fb-flex fb-w-full">
            {Array.from({ length: element.range }, (_, i) => i + 1).map((number, i, a) =>
              renderRatingOption(number, i, a.length)
            )}
          </div>
          <div className="fb-text-subheading fb-mt-8 fb-flex fb-justify-between fb-px-1.5 fb-text-xs fb-leading-6 fb-gap-8">
            <p className="fb-max-w-[50%]" dir="auto">
              {getLocalizedValue(element.lowerLabel, languageCode)}
            </p>
            <p className="fb-max-w-[50%]" dir="auto">
              {getLocalizedValue(element.upperLabel, languageCode)}
            </p>
          </div>
        </fieldset>
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
  else if (range === 6) iconsIdx = [0, 2, 4, 5, 7, 9];
  else if (range === 5) iconsIdx = [3, 4, 5, 6, 7];
  else if (range === 4) iconsIdx = [4, 5, 6, 7];
  else if (range === 3) iconsIdx = [4, 5, 7];

  return getSmiley(iconsIdx[idx], idx, range, active, addColors);
};
