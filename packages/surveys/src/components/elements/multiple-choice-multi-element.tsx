import { useCallback, useEffect, useMemo, useRef, useState } from "preact/hooks";
import { type TResponseData, type TResponseTtc } from "@formbricks/types/responses";
import type { TSurveyMultipleChoiceElement } from "@formbricks/types/surveys/elements";
import { ElementMedia } from "@/components/general/element-media";
import { Headline } from "@/components/general/headline";
import { Subheader } from "@/components/general/subheader";
import { getLocalizedValue } from "@/lib/i18n";
import { getUpdatedTtc, useTtc } from "@/lib/ttc";
import { cn, getShuffledChoicesIds } from "@/lib/utils";

interface MultipleChoiceMultiElementProps {
  element: TSurveyMultipleChoiceElement;
  value: string[];
  onChange: (responseData: TResponseData) => void;
  languageCode: string;
  ttc: TResponseTtc;
  setTtc: (ttc: TResponseTtc) => void;
  autoFocusEnabled: boolean;
  currentElementId: string;
  dir?: "ltr" | "rtl" | "auto";
}

const getInitialOtherSelected = (
  value: string[],
  element: TSurveyMultipleChoiceElement,
  languageCode: string
): boolean => {
  if (!value) return false;
  const choicesWithoutOther = element.choices
    .filter((choice) => choice.id !== "other")
    .map((item) => getLocalizedValue(item.label, languageCode));
  const valueArray = Array.isArray(value) ? value : [value];
  return valueArray.some((item) => !choicesWithoutOther.includes(item));
};

const getInitialOtherValue = (
  value: string[],
  element: TSurveyMultipleChoiceElement,
  languageCode: string
): string => {
  if (!Array.isArray(value)) return "";
  const filtered = value.filter((v) => !element.choices.find((c) => c.label[languageCode] === v));
  return filtered[0] || "";
};

export function MultipleChoiceMultiElement({
  element,
  value,
  onChange,
  languageCode,
  ttc,
  setTtc,
  autoFocusEnabled,
  currentElementId,
  dir = "auto",
}: Readonly<MultipleChoiceMultiElementProps>) {
  const [startTime, setStartTime] = useState(performance.now());
  const isMediaAvailable = element.imageUrl || element.videoUrl;
  useTtc(element.id, ttc, setTtc, startTime, setStartTime, element.id === currentElementId);
  const shuffledChoicesIds = useMemo(() => {
    if (element.shuffleOption) {
      return getShuffledChoicesIds(element.choices, element.shuffleOption);
    }
    return element.choices.map((choice) => choice.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- We only want to recompute this when the shuffleOption changes
  }, [element.shuffleOption, element.choices.length, element.choices[element.choices.length - 1].id]);

  const getChoicesWithoutOtherLabels = useCallback(
    () =>
      element.choices
        .filter((choice) => choice.id !== "other")
        .map((item) => getLocalizedValue(item.label, languageCode)),
    [element, languageCode]
  );

  const [otherSelected, setOtherSelected] = useState<boolean>(() =>
    getInitialOtherSelected(value, element, languageCode)
  );
  const [otherValue, setOtherValue] = useState(() => getInitialOtherValue(value, element, languageCode));

  const elementChoices = useMemo(() => {
    if (!element.choices) {
      return [];
    }
    if (element.shuffleOption === "none" || element.shuffleOption === undefined) return element.choices;
    return shuffledChoicesIds.map((choiceId) => {
      const choice = element.choices.find((currentChoice) => {
        return currentChoice.id === choiceId;
      });
      return choice;
    });
  }, [element.choices, element.shuffleOption, shuffledChoicesIds]);

  const elementChoiceLabels = elementChoices.map((elementChoice) => {
    return elementChoice?.label[languageCode];
  });

  const otherOption = useMemo(
    () => element.choices.find((choice) => choice.id === "other"),
    [element.choices]
  );

  const noneOption = useMemo(() => element.choices.find((choice) => choice.id === "none"), [element.choices]);

  const otherSpecify = useRef<HTMLInputElement | null>(null);
  const choicesContainerRef = useRef<HTMLDivElement | null>(null);

  // Check if "none" option is selected
  const isNoneSelected = useMemo(
    () => Boolean(noneOption && value.includes(getLocalizedValue(noneOption.label, languageCode))),
    [noneOption, value, languageCode]
  );

  // Common label className for all choice types
  const baseLabelClassName =
    "fb-text-heading focus-within:fb-border-brand fb-bg-input-bg focus-within:fb-bg-input-bg-selected hover:fb-bg-input-bg-selected fb-rounded-custom fb-relative fb-flex fb-cursor-pointer fb-flex-col fb-border fb-p-4 focus:fb-outline-none";

  useEffect(() => {
    // Scroll to the bottom of choices container and focus on 'otherSpecify' input when 'otherSelected' is true
    if (otherSelected && choicesContainerRef.current && otherSpecify.current) {
      choicesContainerRef.current.scrollTop = choicesContainerRef.current.scrollHeight;
      otherSpecify.current.focus();
    }
  }, [otherSelected]);

  const addItem = (item: string) => {
    const isOtherValue = !elementChoiceLabels.includes(item);
    const currentValue = Array.isArray(value) ? value : [];

    if (isOtherValue) {
      const newValue = currentValue.filter((v) => elementChoiceLabels.includes(v));
      onChange({ [element.id]: [...newValue, item] });
    } else {
      onChange({ [element.id]: [...currentValue, item] });
    }
  };

  const removeItem = (item: string) => {
    const currentValue = Array.isArray(value) ? value : [];
    onChange({ [element.id]: currentValue.filter((i) => i !== item) });
  };

  const getIsRequired = () => {
    const responseValues = [...value];
    if (otherSelected && otherValue) {
      responseValues.push(otherValue);
    }
    const hasResponse = Array.isArray(responseValues) && responseValues.length > 0;
    return element.required && hasResponse ? false : element.required;
  };

  const handleFormSubmit = (e: Event) => {
    e.preventDefault();
    const choicesWithoutOther = getChoicesWithoutOtherLabels();
    const newValue = value.filter((item) => choicesWithoutOther.includes(item) || item === otherValue);
    if (otherValue && otherSelected && !newValue.includes(otherValue)) {
      newValue.push(otherValue);
    }
    onChange({ [element.id]: newValue });
    const updatedTtcObj = getUpdatedTtc(ttc, element.id, performance.now() - startTime);
    setTtc(updatedTtcObj);
  };

  const handleOtherOptionToggle = () => {
    if (otherSelected) {
      setOtherValue("");
      onChange({
        [element.id]: value.filter((item) => getChoicesWithoutOtherLabels().includes(item)),
      });
    }
    setOtherSelected(!otherSelected);
  };

  const handleOtherValueBlur = () => {
    const newValue = value.filter((item) => getChoicesWithoutOtherLabels().includes(item));
    if (otherValue && otherSelected) {
      newValue.push(otherValue);
      onChange({ [element.id]: newValue });
    }
  };

  const handleNoneOptionChange = (checked: boolean) => {
    if (checked) {
      setOtherSelected(false);
      setOtherValue("");
      onChange({ [element.id]: [getLocalizedValue(noneOption!.label, languageCode)] });
    } else {
      removeItem(getLocalizedValue(noneOption!.label, languageCode));
    }
  };

  const handleKeyDown = (choiceId: string) => (e: KeyboardEvent) => {
    if (e.key === " ") {
      e.preventDefault();
      document.getElementById(choiceId)?.click();
    }
  };

  const otherOptionInputDir = !otherValue ? dir : "auto";

  const renderChoice = (choice: NonNullable<(typeof elementChoices)[0]>, idx: number) => {
    if (choice.id === "other" || choice.id === "none") return null;
    const choiceLabel = getLocalizedValue(choice.label, languageCode);
    const isChecked = Array.isArray(value) && value.includes(choiceLabel);
    const labelClassName = cn(
      isChecked ? "fb-border-brand fb-bg-input-bg-selected fb-z-10" : "fb-border-border fb-bg-input-bg",
      isNoneSelected ? "fb-opacity-50" : "",
      baseLabelClassName
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
            type="checkbox"
            dir={dir}
            id={choice.id}
            name={element.id}
            tabIndex={-1}
            value={choiceLabel}
            className="fb-border-brand fb-text-brand fb-h-4 fb-w-4 fb-flex-shrink-0 fb-border focus:fb-ring-0 focus:fb-ring-offset-0"
            aria-labelledby={`${choice.id}-label`}
            disabled={isNoneSelected}
            onChange={(e) => {
              const checked = (e.target as HTMLInputElement).checked;
              if (checked) {
                addItem(choiceLabel);
              } else {
                removeItem(choiceLabel);
              }
            }}
            checked={isChecked}
            required={getIsRequired()}
          />
          <span id={`${choice.id}-label`} className="fb-mx-3 fb-grow fb-font-medium" dir="auto">
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
      otherSelected ? "fb-border-brand fb-bg-input-bg-selected fb-z-10" : "fb-border-border fb-bg-input-bg",
      isNoneSelected ? "fb-opacity-50" : "",
      baseLabelClassName
    );
    const placeholder =
      getLocalizedValue(element.otherOptionPlaceholder, languageCode).length > 0
        ? getLocalizedValue(element.otherOptionPlaceholder, languageCode)
        : "Please specify";

    return (
      <label
        tabIndex={0} // NOSONAR - needed for keyboard navigation through options
        className={labelClassName}
        // Disable keyboard navigation when 'other' option is selected to allow space key in input field
        onKeyDown={otherSelected ? undefined : handleKeyDown(otherOption.id)} // NOSONAR - needed for keyboard navigation through options
      >
        <span className="fb-flex fb-items-center fb-text-sm">
          <input
            type="checkbox"
            dir={dir}
            tabIndex={-1}
            id={otherOption.id}
            name={element.id}
            value={otherLabel}
            className="fb-border-brand fb-text-brand fb-h-4 fb-w-4 fb-flex-shrink-0 fb-border focus:fb-ring-0 focus:fb-ring-offset-0"
            aria-labelledby={`${otherOption.id}-label`}
            disabled={isNoneSelected}
            onChange={handleOtherOptionToggle}
            checked={otherSelected}
          />
          <span id={`${otherOption.id}-label`} className="fb-ml-3 fb-mr-3 fb-grow fb-font-medium" dir="auto">
            {otherLabel}
          </span>
        </span>
        {otherSelected && (
          <input
            ref={otherSpecify}
            dir={otherOptionInputDir}
            id={`${otherOption.id}-specify`}
            maxLength={250}
            name={element.id}
            tabIndex={0}
            value={otherValue}
            pattern=".*\S+.*"
            onChange={(e) => setOtherValue(e.currentTarget.value)}
            onBlur={handleOtherValueBlur}
            className="placeholder:fb-text-placeholder fb-border-border fb-bg-survey-bg fb-text-heading focus:fb-ring-focus fb-rounded-custom fb-mt-3 fb-flex fb-h-10 fb-w-full fb-border fb-px-3 fb-py-2 fb-text-sm focus:fb-outline-none focus:fb-ring-2 focus:fb-ring-offset-2 disabled:fb-cursor-not-allowed disabled:fb-opacity-50"
            placeholder={placeholder}
            required={element.required}
            aria-labelledby={`${otherOption.id}-label`}
          />
        )}
      </label>
    );
  };

  const renderNoneOption = () => {
    if (!noneOption) return null;
    const noneLabel = getLocalizedValue(noneOption.label, languageCode);
    const labelClassName = cn(
      isNoneSelected ? "fb-border-brand fb-bg-input-bg-selected fb-z-10" : "fb-border-border fb-bg-input-bg",
      baseLabelClassName
    );

    return (
      <label
        tabIndex={0} // NOSONAR - needed for keyboard navigation through options
        className={labelClassName}
        onKeyDown={handleKeyDown(noneOption.id)} // NOSONAR - needed for keyboard navigation through options
      >
        <span className="fb-flex fb-items-center fb-text-sm">
          <input
            type="checkbox"
            dir={dir}
            tabIndex={-1}
            id={noneOption.id}
            name={element.id}
            value={noneLabel}
            className="fb-border-brand fb-text-brand fb-h-4 fb-w-4 fb-flex-shrink-0 fb-border focus:fb-ring-0 focus:fb-ring-offset-0"
            aria-labelledby={`${noneOption.id}-label`}
            onChange={(e) => handleNoneOptionChange((e.target as HTMLInputElement).checked)}
            checked={isNoneSelected}
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
          <div className="fb-bg-survey-bg fb-relative fb-space-y-2" ref={choicesContainerRef}>
            {elementChoices.map((choice, idx) => choice && renderChoice(choice, idx))}
            {renderOtherOption()}
            {renderNoneOption()}
          </div>
        </fieldset>
      </div>
    </form>
  );
}
