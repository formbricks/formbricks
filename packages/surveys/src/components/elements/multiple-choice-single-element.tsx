import { useEffect, useMemo, useState } from "preact/hooks";
import { SingleSelect, type SingleSelectOption } from "@formbricks/survey-ui";
import { type TResponseData, type TResponseTtc } from "@formbricks/types/responses";
import type { TSurveyMultipleChoiceElement } from "@formbricks/types/surveys/elements";
import { getLocalizedValue } from "@/lib/i18n";
import { getUpdatedTtc, useTtc } from "@/lib/ttc";
import { getShuffledChoicesIds } from "@/lib/utils";

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
  currentElementId,
  dir = "auto",
}: Readonly<MultipleChoiceSingleElementProps>) {
  const [startTime, setStartTime] = useState(performance.now());
  const [otherValue, setOtherValue] = useState("");
  const isCurrent = element.id === currentElementId;
  useTtc(element.id, ttc, setTtc, startTime, setStartTime, isCurrent);

  const shuffledChoicesIds = useMemo(() => {
    if (element.shuffleOption) {
      return getShuffledChoicesIds(element.choices, element.shuffleOption);
    }
    return element.choices.map((choice) => choice.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only want to run this effect when element.choices changes
  }, [element.shuffleOption, element.choices.length, element.choices[element.choices.length - 1].id]);

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

  // Determine if "other" is selected
  const isOtherSelected = useMemo(() => {
    if (!otherOption) return false;

    // Special-case: empty string means "other selected but not filled yet"
    if (value === "") return true;
    if (!value) return false;

    // Backwards-compat: if an ID was stored previously, treat it as a normal selection (if it matches)
    const choiceLabels = elementChoices
      .filter((c) => c && c.id !== "other")
      .map((c) => getLocalizedValue(c!.label, languageCode));
    const choiceIds = elementChoices.filter((c) => c && c.id !== "other").map((c) => c!.id);

    if (choiceIds.includes(value)) return false;
    if (choiceLabels.includes(value)) return false;

    // Otherwise, it's a custom value => "other"
    return true;
  }, [value, otherOption, elementChoices, languageCode]);

  useEffect(() => {
    if (isOtherSelected) setOtherValue(value ?? "");
  }, [isOtherSelected, value]);

  const handleChange = (selectedValue: string) => {
    if (selectedValue === otherOption?.id) {
      setOtherValue("");
      onChange({ [element.id]: "" });
    } else {
      const matchingOption = allOptions.find((opt) => opt.id === selectedValue);
      onChange({ [element.id]: matchingOption?.label ?? selectedValue });
    }
    const updatedTtcObj = getUpdatedTtc(ttc, element.id, performance.now() - startTime);
    setTtc(updatedTtcObj);
  };

  const handleOtherValueChange = (newOtherValue: string) => {
    setOtherValue(newOtherValue);
    onChange({ [element.id]: newOtherValue });
  };

  const handleSubmit = (e: Event) => {
    e.preventDefault();
    const updatedTtcObj = getUpdatedTtc(ttc, element.id, performance.now() - startTime);
    setTtc(updatedTtcObj);
  };

  // Convert element choices to SingleSelect options
  const options: SingleSelectOption[] = useMemo(() => {
    return elementChoices
      .filter((choice) => choice && choice.id !== "other" && choice.id !== "none")
      .map((choice) => ({
        id: choice!.id,
        label: getLocalizedValue(choice!.label, languageCode),
      }));
  }, [elementChoices, languageCode]);

  // Add "none" option if it exists
  const allOptions: SingleSelectOption[] = useMemo(() => {
    if (noneOption) {
      return [
        ...options,
        {
          id: noneOption.id,
          label: getLocalizedValue(noneOption.label, languageCode),
        },
      ];
    }
    return options;
  }, [options, noneOption, languageCode]);

  // Determine the selected value
  const selectedValue = useMemo(() => {
    if (!value && value !== "") return undefined;

    // Empty string => other selected (but not filled)
    if (value === "" && otherOption) return otherOption.id;

    // Backwards-compat: if value is already an option ID, use it directly
    const idMatch = allOptions.find((opt) => opt.id === value);
    if (idMatch) return idMatch.id;

    // Normal path: stored value is the label, map to option ID
    const labelMatch = allOptions.find((opt) => opt.label === value);
    if (labelMatch) return labelMatch.id;

    // Custom value => other
    if (otherOption && isOtherSelected) return otherOption.id;

    return undefined;
  }, [value, otherOption, allOptions, isOtherSelected]);

  return (
    <form key={element.id} onSubmit={handleSubmit} className="w-full">
      <SingleSelect
        elementId={element.id}
        inputId={element.id}
        headline={getLocalizedValue(element.headline, languageCode)}
        description={element.subheader ? getLocalizedValue(element.subheader, languageCode) : undefined}
        options={allOptions}
        value={selectedValue}
        onChange={handleChange}
        required={element.required}
        dir={dir}
        otherOptionId={otherOption?.id}
        otherOptionLabel={otherOption ? getLocalizedValue(otherOption.label, languageCode) : undefined}
        otherOptionPlaceholder={
          element.otherOptionPlaceholder && getLocalizedValue(element.otherOptionPlaceholder, languageCode)
            ? getLocalizedValue(element.otherOptionPlaceholder, languageCode)
            : "Please specify"
        }
        otherValue={otherValue}
        onOtherValueChange={handleOtherValueChange}
        imageUrl={element.imageUrl}
        videoUrl={element.videoUrl}
      />
    </form>
  );
}
