import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import { type TResponseData, type TResponseTtc } from "@formbricks/types/responses";
import type { TSurveyMultipleChoiceElement } from "@formbricks/types/surveys/elements";
import { ElementMedia } from "@/components/general/element-media";
import { Headline } from "@/components/general/headline";
import { Subheader } from "@/components/general/subheader";
import { getLocalizedValue } from "@/lib/i18n";
import { getUpdatedTtc, useTtc } from "@/lib/ttc";
import { cn, getShuffledChoicesIds } from "@/lib/utils";

interface MultipleChoiceSingleElementProps {
  element: TSurveyMultipleChoiceElement;
  value?: string;
  onChange: (responseData: TResponseData) => void;
  languageCode: string;
  ttc: TResponseTtc;
  setTtc: (ttc: TResponseTtc) => void;
  autoFocusEnabled: boolean;
  currentElementId: string;
  dir?: "ltr" | "rtl" | "auto";
}

export function MultipleChoiceSingleElement({
  element,
  value,
  onChange,
  languageCode,
  ttc,
  setTtc,
  autoFocusEnabled,
  currentElementId,
  dir = "auto",
}: Readonly<MultipleChoiceSingleElementProps>) {
  const [startTime, setStartTime] = useState(performance.now());
  const [otherSelected, setOtherSelected] = useState(false);
  const otherSpecify = useRef<HTMLInputElement | null>(null);
  const choicesContainerRef = useRef<HTMLDivElement | null>(null);
  const isMediaAvailable = element.imageUrl || element.videoUrl;
  const shuffledChoicesIds = useMemo(() => {
    if (element.shuffleOption) {
      return getShuffledChoicesIds(element.choices, element.shuffleOption);
    }
    return element.choices.map((choice) => choice.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only want to run this effect when element.choices changes
  }, [element.shuffleOption, element.choices.length, element.choices[element.choices.length - 1].id]);

  useTtc(element.id, ttc, setTtc, startTime, setStartTime, element.id === currentElementId);

  const elementChoices = useMemo(() => {
    if (!element.choices.length) {
      return [];
    }
    if (element.shuffleOption === "none" || element.shuffleOption === undefined) return element.choices;
    return shuffledChoicesIds.map((choiceId) => {
      const choice = element.choices.find((selectedChoice) => {
        return selectedChoice.id === choiceId;
      });
      return choice;
    });
  }, [element.choices, element.shuffleOption, shuffledChoicesIds]);

  const otherOption = useMemo(
    () => element.choices.find((choice) => choice.id === "other"),
    [element.choices]
  );

  const noneOption = useMemo(() => element.choices.find((choice) => choice.id === "none"), [element.choices]);

  useEffect(() => {
    if (!value) {
      const prefillAnswer = new URLSearchParams(window.location.search).get(element.id);
      if (
        prefillAnswer &&
        otherOption &&
        prefillAnswer === getLocalizedValue(otherOption.label, languageCode)
      ) {
        setOtherSelected(true);
        return;
      }
    }

    const isOtherSelected =
      value !== undefined && !elementChoices.some((choice) => choice?.label[languageCode] === value);
    setOtherSelected(isOtherSelected);
  }, [languageCode, otherOption, element.id, elementChoices, value]);

  useEffect(() => {
    // Scroll to the bottom of choices container and focus on 'otherSpecify' input when 'otherSelected' is true
    if (otherSelected && choicesContainerRef.current && otherSpecify.current) {
      choicesContainerRef.current.scrollTop = choicesContainerRef.current.scrollHeight;
      otherSpecify.current.focus();
    }
  }, [otherSelected]);

  const otherOptionInputDir = !value ? dir : "auto";

  const handleFormSubmit = (e: Event) => {
    e.preventDefault();
    const updatedTtcObj = getUpdatedTtc(ttc, element.id, performance.now() - startTime);
    setTtc(updatedTtcObj);
  };

  const handleChoiceClick = (choiceValue: string) => {
    if (!element.required && value === choiceValue) {
      onChange({ [element.id]: undefined });
    } else {
      setOtherSelected(false);
      onChange({ [element.id]: choiceValue });
    }
  };

  const handleOtherOptionClick = () => {
    if (otherSelected && !element.required) {
      onChange({ [element.id]: undefined });
      setOtherSelected(false);
    } else if (!otherSelected) {
      setOtherSelected(true);
      onChange({ [element.id]: "" });
    }
  };

  const handleNoneOptionClick = () => {
    const noneValue = getLocalizedValue(noneOption!.label, languageCode);
    if (!element.required && value === noneValue) {
      onChange({ [element.id]: undefined });
    } else {
      setOtherSelected(false);
      onChange({ [element.id]: noneValue });
    }
  };

  const handleKeyDown = (choiceId: string) => (e: KeyboardEvent) => {
    if (e.key === " ") {
      e.preventDefault();
      document.getElementById(choiceId)?.click();
      document.getElementById(choiceId)?.focus();
    }
  };

  const handleOtherKeyDown = (e: KeyboardEvent) => {
    if (e.key === " ") {
      if (otherSelected) return;
      document.getElementById(otherOption!.id)?.click();
      document.getElementById(otherOption!.id)?.focus();
    }
  };

  const renderChoice = (choice: NonNullable<(typeof elementChoices)[0]>, idx: number) => {
    if (choice.id === "other" || choice.id === "none") return null;
    const choiceLabel = getLocalizedValue(choice.label, languageCode);
    const isChecked = value === choiceLabel;
    const labelClassName = cn(
      isChecked ? "fb-border-brand fb-bg-input-bg-selected fb-z-10" : "fb-border-border",
      "fb-text-heading fb-bg-input-bg focus-within:fb-border-brand focus-within:fb-bg-input-bg-selected hover:fb-bg-input-bg-selected fb-rounded-custom fb-relative fb-flex fb-cursor-pointer fb-flex-col fb-border fb-p-4 focus:fb-outline-none"
    );

    return (
      <label
        key={choice.id}
        tabIndex={0} // NOSONAR - needed for keyboard navigation through options
        className={labelClassName}
        onKeyDown={handleKeyDown(choice.id)} // NOSONAR - needed for keyboard navigation through options
        autoFocus={idx === 0 && autoFocusEnabled}>
        <span className="fb-flex fb-items-center fb-text-sm">
          <input
            tabIndex={-1}
            type="radio"
            id={choice.id}
            name={element.id}
            value={choiceLabel}
            dir={dir}
            className="fb-border-brand fb-text-brand fb-h-4 fb-w-4 fb-flex-shrink-0 fb-border focus:fb-ring-0 focus:fb-ring-offset-0"
            aria-labelledby={`${choice.id}-label`}
            onClick={() => handleChoiceClick(choiceLabel)}
            checked={isChecked}
            required={element.required ? idx === 0 : undefined}
          />
          <span id={`${choice.id}-label`} className="fb-ml-3 fb-mr-3 fb-grow fb-font-medium" dir="auto">
            {choiceLabel}
          </span>
        </span>
      </label>
    );
  };

  const renderOtherOption = () => {
    if (!otherOption) return null;
    const otherLabel = getLocalizedValue(otherOption.label, languageCode);
    const labelClassName = cn(
      otherSelected ? "fb-border-brand fb-bg-input-bg-selected fb-z-10" : "fb-border-border",
      "fb-text-heading focus-within:fb-border-brand fb-bg-input-bg focus-within:fb-bg-input-bg-selected hover:fb-bg-input-bg-selected fb-rounded-custom fb-relative fb-flex fb-cursor-pointer fb-flex-col fb-border fb-p-4 focus:fb-outline-none"
    );
    const placeholder =
      getLocalizedValue(element.otherOptionPlaceholder, languageCode).length > 0
        ? getLocalizedValue(element.otherOptionPlaceholder, languageCode)
        : "Please specify";

    return (
      <label
        tabIndex={0} // NOSONAR - needed for keyboard navigation through options
        className={labelClassName}
        onKeyDown={handleOtherKeyDown} // NOSONAR - needed for keyboard navigation through options
      >
        <span className="fb-flex fb-items-center fb-text-sm">
          <input
            tabIndex={-1}
            dir={dir}
            type="radio"
            id={otherOption.id}
            name={element.id}
            value={otherLabel}
            className="fb-border-brand fb-text-brand fb-h-4 fb-w-4 fb-flex-shrink-0 fb-border focus:fb-ring-0 focus:fb-ring-offset-0"
            aria-labelledby={`${otherOption.id}-label`}
            onClick={handleOtherOptionClick}
            checked={otherSelected}
          />
          <span id={`${otherOption.id}-label`} className="fb-ml-3 fb-mr-3 fb-grow fb-font-medium" dir="auto">
            {otherLabel}
          </span>
        </span>
        {otherSelected && (
          <input
            ref={otherSpecify}
            id={`${otherOption.id}-input`}
            dir={otherOptionInputDir}
            name={element.id}
            pattern=".*\S+.*"
            value={value ?? ""}
            onChange={(e) => onChange({ [element.id]: e.currentTarget.value })}
            className="placeholder:fb-text-placeholder fb-border-border fb-bg-survey-bg fb-text-heading focus:fb-ring-focus fb-rounded-custom fb-mt-3 fb-flex fb-h-10 fb-w-full fb-border fb-px-3 fb-py-2 fb-text-sm focus:fb-outline-none focus:fb-ring-2 focus:fb-ring-offset-2 disabled:fb-cursor-not-allowed disabled:fb-opacity-50"
            placeholder={placeholder}
            required={element.required}
            aria-labelledby={`${otherOption.id}-label`}
            maxLength={250}
          />
        )}
      </label>
    );
  };

  const renderNoneOption = () => {
    if (!noneOption) return null;
    const noneLabel = getLocalizedValue(noneOption.label, languageCode);
    const isChecked = value === noneLabel;
    const labelClassName = cn(
      isChecked ? "fb-border-brand fb-bg-input-bg-selected fb-z-10" : "fb-border-border",
      "fb-text-heading focus-within:fb-border-brand fb-bg-input-bg focus-within:fb-bg-input-bg-selected hover:fb-bg-input-bg-selected fb-rounded-custom fb-relative fb-flex fb-cursor-pointer fb-flex-col fb-border fb-p-4 focus:fb-outline-none"
    );

    return (
      <label
        tabIndex={0} // NOSONAR - needed for keyboard navigation through options
        className={labelClassName}
        onKeyDown={handleKeyDown(noneOption.id)}>
        <span className="fb-flex fb-items-center fb-text-sm">
          <input
            tabIndex={-1}
            dir={dir}
            type="radio"
            id={noneOption.id}
            name={element.id}
            value={noneLabel}
            className="fb-border-brand fb-text-brand fb-h-4 fb-w-4 fb-flex-shrink-0 fb-border focus:fb-ring-0 focus:fb-ring-offset-0"
            aria-labelledby={`${noneOption.id}-label`}
            onClick={handleNoneOptionClick}
            checked={isChecked}
          />
          <span id={`${noneOption.id}-label`} className="fb-ml-3 fb-mr-3 fb-grow fb-font-medium" dir="auto">
            {noneLabel}
          </span>
        </span>
      </label>
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
      <div className="fb-mt-4">
        <fieldset>
          <legend className="fb-sr-only">Options</legend>
          <div
            className="fb-bg-survey-bg fb-relative fb-space-y-2"
            role="radiogroup"
            ref={choicesContainerRef}>
            {elementChoices.map((choice, idx) => choice && renderChoice(choice, idx))}
            {renderOtherOption()}
            {renderNoneOption()}
          </div>
        </fieldset>
      </div>
    </form>
  );
}
