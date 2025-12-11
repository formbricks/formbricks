import { useState } from "preact/hooks";
import { type TResponseData, type TResponseTtc } from "@formbricks/types/responses";
import type { TSurveyNPSElement } from "@formbricks/types/surveys/elements";
import { ElementMedia } from "@/components/general/element-media";
import { Headline } from "@/components/general/headline";
import { Subheader } from "@/components/general/subheader";
import { getLocalizedValue } from "@/lib/i18n";
import { getUpdatedTtc, useTtc } from "@/lib/ttc";
import { cn } from "@/lib/utils";

interface NPSElementProps {
  element: TSurveyNPSElement;
  value?: number;
  onChange: (responseData: TResponseData) => void;
  languageCode: string;
  ttc: TResponseTtc;
  setTtc: (ttc: TResponseTtc) => void;
  autoFocusEnabled: boolean;
  currentElementId: string;
  dir?: "ltr" | "rtl" | "auto";
}

export function NPSElement({
  element,
  value,
  onChange,
  languageCode,
  ttc,
  setTtc,
  currentElementId,
  dir = "auto",
}: Readonly<NPSElementProps>) {
  const [startTime, setStartTime] = useState(performance.now());
  const [hoveredNumber, setHoveredNumber] = useState(-1);
  const isMediaAvailable = element.imageUrl || element.videoUrl;
  useTtc(element.id, ttc, setTtc, startTime, setStartTime, element.id === currentElementId);

  const handleClick = (number: number) => {
    onChange({ [element.id]: number });
    const updatedTtcObj = getUpdatedTtc(ttc, element.id, performance.now() - startTime);
    setTtc(updatedTtcObj);
  };

  const getNPSOptionColor = (idx: number) => {
    if (idx > 8) return "fb-bg-emerald-100";
    if (idx > 6) return "fb-bg-orange-100";
    return "fb-bg-rose-100";
  };

  return (
    <form
      key={element.id}
      onSubmit={(e) => {
        e.preventDefault();
        const updatedTtcObj = getUpdatedTtc(ttc, element.id, performance.now() - startTime);
        setTtc(updatedTtcObj);
      }}>
      {isMediaAvailable ? <ElementMedia imgUrl={element.imageUrl} videoUrl={element.videoUrl} /> : null}
      <Headline
        headline={getLocalizedValue(element.headline, languageCode)}
        elementId={element.id}
        required={element.required}
      />
      <Subheader
        subheader={element.subheader ? getLocalizedValue(element.subheader, languageCode) : ""}
        elementId={element.id}
      />
      <div className="fb-my-4">
        <fieldset>
          <legend className="fb-sr-only">Options</legend>
          <div className="fb-flex">
            {Array.from({ length: 11 }, (_, i) => i).map((number, idx) => {
              return (
                <label
                  key={number}
                  tabIndex={0} // NOSONAR - needed for keyboard navigation through options
                  onMouseOver={() => {
                    setHoveredNumber(number);
                  }}
                  onMouseLeave={() => {
                    setHoveredNumber(-1);
                  }}
                  onFocus={() => {
                    setHoveredNumber(number);
                  }}
                  onBlur={() => {
                    setHoveredNumber(-1);
                  }}
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
                      ? "fb-border-border-highlight fb-bg-accent-selected-bg fb-z-10 fb-border"
                      : "fb-border-border",
                    "fb-text-heading focus:fb-border-brand fb-relative fb-h-10 fb-flex-1 fb-cursor-pointer fb-overflow-hidden fb-border-b fb-border-l fb-border-t fb-text-center fb-text-sm focus:fb-border-2 focus:fb-outline-none",
                    element.isColorCodingEnabled ? "fb-h-[46px] fb-leading-[3.5em]" : "fb-h fb-leading-10",
                    hoveredNumber === number ? "fb-bg-accent-bg" : "",
                    dir === "rtl"
                      ? "first:fb-rounded-r-custom first:fb-border-r last:fb-rounded-l-custom last:fb-border-l"
                      : "first:fb-rounded-l-custom first:fb-border-l last:fb-rounded-r-custom last:fb-border-r"
                  )}>
                  {element.isColorCodingEnabled ? (
                    <div
                      className={`fb-absolute fb-left-0 fb-top-0 fb-h-[6px] fb-w-full ${getNPSOptionColor(idx)}`}
                    />
                  ) : null}
                  <input
                    type="radio"
                    id={number.toString()}
                    name="nps"
                    value={number}
                    checked={value === number}
                    className="fb-absolute fb-left-0 fb-h-full fb-w-full fb-cursor-pointer fb-opacity-0"
                    onClick={() => {
                      handleClick(number);
                    }}
                    required={element.required}
                    tabIndex={-1}
                  />
                  {number}
                </label>
              );
            })}
          </div>
          <div className="fb-text-subheading fb-mt-2 fb-flex fb-justify-between fb-px-1.5 fb-text-xs fb-leading-6 fb-gap-8">
            <p dir="auto" className="fb-max-w-[50%]">
              {getLocalizedValue(element.lowerLabel, languageCode)}
            </p>
            <p dir="auto" className="fb-max-w-[50%]">
              {getLocalizedValue(element.upperLabel, languageCode)}
            </p>
          </div>
        </fieldset>
      </div>
    </form>
  );
}
