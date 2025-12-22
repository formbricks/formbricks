import { useCallback, useEffect, useMemo, useState } from "preact/hooks";
import { useTranslation } from "react-i18next";
import { MultiSelect, type MultiSelectOption } from "@formbricks/survey-ui";
import { type TResponseData, type TResponseTtc } from "@formbricks/types/responses";
import type { TSurveyMultipleChoiceElement } from "@formbricks/types/surveys/elements";
import { getLocalizedValue } from "@/lib/i18n";
import { getUpdatedTtc, useTtc } from "@/lib/ttc";
import { getShuffledChoicesIds } from "@/lib/utils";

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

export function MultipleChoiceMultiElement({
  element,
  value,
  onChange,
  languageCode,
  ttc,
  setTtc,
  currentElementId,
  dir = "auto",
}: Readonly<MultipleChoiceMultiElementProps>) {
  const [startTime, setStartTime] = useState(performance.now());
  const [otherValue, setOtherValue] = useState("");
  const isCurrent = element.id === currentElementId;
  const { t } = useTranslation();
  useTtc(element.id, ttc, setTtc, startTime, setStartTime, isCurrent);

  const shuffledChoicesIds = useMemo(() => {
    if (element.shuffleOption) {
      return getShuffledChoicesIds(element.choices, element.shuffleOption);
    }
    return element.choices.map((choice) => choice.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- We only want to recompute this when the shuffleOption changes
  }, [element.shuffleOption, element.choices.length, element.choices[element.choices.length - 1].id]);

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

  const otherOption = useMemo(
    () => element.choices.find((choice) => choice.id === "other"),
    [element.choices]
  );

  const noneOption = useMemo(() => element.choices.find((choice) => choice.id === "none"), [element.choices]);

  // Convert element choices to MultiSelect options
  const options: MultiSelectOption[] = useMemo(() => {
    return elementChoices
      .filter((choice) => choice && choice.id !== "other" && choice.id !== "none")
      .map((choice) => ({
        id: choice!.id,
        label: getLocalizedValue(choice!.label, languageCode),
      }));
  }, [elementChoices, languageCode]);

  // Add "none" option if it exists
  const allOptions: MultiSelectOption[] = useMemo(() => {
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

  // Determine if "other" is selected
  const isOtherSelected = useMemo(() => {
    if (!otherOption) return false;
    if (!Array.isArray(value) || value.length === 0) return false;

    // Current representation: "" sentinel means "other selected"
    if (value.includes("")) return true;

    // Backwards-compat: "other" option ID might have been stored
    if (value.includes(otherOption.id)) return true;

    // Backwards-compat: if any entry is neither a known label nor a known option id, treat as custom "other" text
    const knownLabels = new Set(
      elementChoices
        .filter((c) => c && c.id !== "other")
        .map((c) => getLocalizedValue(c!.label, languageCode))
    );
    const knownIds = new Set(elementChoices.filter((c) => c && c.id !== "other").map((c) => c!.id));

    return value.some((v) => v !== "" && !knownLabels.has(v) && !knownIds.has(v));
  }, [value, otherOption, elementChoices, languageCode]);

  // Extract the other value from the response value array (supports legacy representations)
  useEffect(() => {
    if (!isOtherSelected || !Array.isArray(value)) return;

    // Current representation: ["", "<custom>"]
    const sentinelIndex = value.indexOf("");
    if (sentinelIndex !== -1) {
      setOtherValue(value[sentinelIndex + 1] ?? "");
      return;
    }

    // Legacy: ["other", "<custom>"] or ["other"]
    if (otherOption) {
      const otherIdIndex = value.indexOf(otherOption.id);
      if (otherIdIndex !== -1) {
        setOtherValue(value[otherIdIndex + 1] ?? "");
        return;
      }
    }

    // Legacy: ["<custom>"] (no sentinel) - take the first unknown entry
    const knownLabels = new Set(
      elementChoices
        .filter((c) => c && c.id !== "other")
        .map((c) => getLocalizedValue(c!.label, languageCode))
    );
    const knownIds = new Set(elementChoices.filter((c) => c && c.id !== "other").map((c) => c!.id));
    const unknown = value.find((v) => v !== "" && !knownLabels.has(v) && !knownIds.has(v));
    setOtherValue(unknown ?? "");
  }, [isOtherSelected, value, otherOption, elementChoices, languageCode]);

  const getNormalizedSelectedLabels = useCallback((): string[] => {
    if (!Array.isArray(value) || value.length === 0) return [];

    const selectedLabels: string[] = [];
    value.forEach((v) => {
      if (!v || v === "" || v === otherOption?.id) return;

      // If an ID was stored, map to label
      const byId = allOptions.find((opt) => opt.id === v);
      if (byId) {
        selectedLabels.push(byId.label);
        return;
      }

      // If a label was stored, keep it (but ensure it is a known option)
      const byLabel = allOptions.find((opt) => opt.label === v);
      if (byLabel) selectedLabels.push(byLabel.label);
    });

    return selectedLabels;
  }, [value, otherOption?.id, allOptions]);

  const handleOtherValueChange = (newOtherValue: string) => {
    setOtherValue(newOtherValue);
    const baseLabels = getNormalizedSelectedLabels();

    const nextValue = [...baseLabels, ""];
    if (newOtherValue.trim()) nextValue.push(newOtherValue);

    onChange({ [element.id]: nextValue });
  };

  const handleSubmit = (e: Event) => {
    e.preventDefault();
    const updatedTtcObj = getUpdatedTtc(ttc, element.id, performance.now() - startTime);
    setTtc(updatedTtcObj);
  };

  // For the survey-ui component, we need to map labels to IDs
  const selectedValues = useMemo(() => {
    if (!value || !Array.isArray(value)) return [];

    const selected: string[] = [];
    value.forEach((val) => {
      if (val === "") {
        // Empty string indicates "other" is selected
        if (otherOption) {
          selected.push(otherOption.id);
        }
      } else {
        // Backwards-compat: if value is already an option ID
        const idMatch = allOptions.find((opt) => opt.id === val);
        if (idMatch) {
          selected.push(idMatch.id);
          return;
        }

        // Normal: value is a label
        const labelMatch = allOptions.find((opt) => opt.label === val);
        if (labelMatch) selected.push(labelMatch.id);
      }
    });

    // Legacy: custom value without sentinel => "other" should be selected
    if (isOtherSelected && otherOption && !selected.includes(otherOption.id)) {
      selected.push(otherOption.id);
    }

    return selected;
  }, [value, allOptions, otherOption, isOtherSelected]);

  // Handle selection changes - store labels directly instead of IDs
  const handleMultiSelectChange = (selectedIds: string[]) => {
    const nextLabels: string[] = [];
    const isOtherNowSelected = Boolean(otherOption) && selectedIds.includes(otherOption!.id);

    selectedIds.forEach((id) => {
      if (id === otherOption?.id) return;
      const matchingOption = allOptions.find((opt) => opt.id === id);
      if (matchingOption) nextLabels.push(matchingOption.label);
    });

    if (isOtherNowSelected) {
      nextLabels.push("");
      if (otherValue.trim()) nextLabels.push(otherValue);
    } else if (otherValue) {
      // If other was deselected, clear any stale other value
      setOtherValue("");
    }

    onChange({ [element.id]: nextLabels });

    const updatedTtcObj = getUpdatedTtc(ttc, element.id, performance.now() - startTime);
    setTtc(updatedTtcObj);
  };

  return (
    <form key={element.id} onSubmit={handleSubmit} className="w-full">
      <MultiSelect
        elementId={element.id}
        inputId={element.id}
        headline={getLocalizedValue(element.headline, languageCode)}
        description={element.subheader ? getLocalizedValue(element.subheader, languageCode) : undefined}
        options={allOptions}
        value={selectedValues}
        onChange={handleMultiSelectChange}
        required={element.required}
        dir={dir}
        otherOptionId={otherOption?.id}
        otherOptionLabel={otherOption ? getLocalizedValue(otherOption.label, languageCode) : undefined}
        otherOptionPlaceholder={
          element.otherOptionPlaceholder && getLocalizedValue(element.otherOptionPlaceholder, languageCode)
            ? getLocalizedValue(element.otherOptionPlaceholder, languageCode)
            : t("common.please_specify")
        }
        otherValue={otherValue}
        onOtherValueChange={handleOtherValueChange}
        exclusiveOptionIds={noneOption ? [noneOption.id] : []}
        imageUrl={element.imageUrl}
        videoUrl={element.videoUrl}
      />
    </form>
  );
}
