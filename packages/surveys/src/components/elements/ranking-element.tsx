import { useMemo, useState } from "preact/hooks";
import { useTranslation } from "react-i18next";
import { Ranking, type RankingOption } from "@formbricks/survey-ui";
import { type TResponseData, type TResponseTtc } from "@formbricks/types/responses";
import type { TSurveyRankingElement } from "@formbricks/types/surveys/elements";
import { getLocalizedValue } from "@/lib/i18n";
import { getUpdatedTtc, useTtc } from "@/lib/ttc";
import { getShuffledChoicesIds } from "@/lib/utils";

interface RankingElementProps {
  element: TSurveyRankingElement;
  value: string[];
  onChange: (responseData: TResponseData) => void;
  languageCode: string;
  ttc: TResponseTtc;
  setTtc: (ttc: TResponseTtc) => void;
  autoFocusEnabled: boolean;
  currentElementId: string;
}

export function RankingElement({
  element,
  value,
  onChange,
  languageCode,
  ttc,
  setTtc,
  currentElementId,
}: Readonly<RankingElementProps>) {
  const { t } = useTranslation();
  const [startTime, setStartTime] = useState(performance.now());
  const [errorMessage, setErrorMessage] = useState<string | undefined>(undefined);
  const isCurrent = element.id === currentElementId;

  useTtc(element.id, ttc, setTtc, startTime, setStartTime, isCurrent);

  const shuffledChoicesIds = useMemo(() => {
    if (element.shuffleOption) {
      return getShuffledChoicesIds(element.choices, element.shuffleOption);
    }
    return element.choices.map((choice) => choice.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [element.shuffleOption, element.choices.length]);

  const elementChoices = useMemo(() => {
    if (!element.choices.length) {
      return [];
    }
    if (element.shuffleOption === "none") {
      return element.choices;
    }
    return shuffledChoicesIds
      .map((shuffledIdx) => {
        const found = element.choices.find((c) => c.id === shuffledIdx);
        return found;
      })
      .filter(Boolean);
  }, [element.shuffleOption, element.choices, shuffledChoicesIds]);

  // Convert choices to RankingOption format
  const options: RankingOption[] = useMemo(() => {
    return elementChoices
      .filter((choice): choice is NonNullable<typeof choice> => choice !== undefined)
      .map((choice) => ({
        id: choice.id,
        label: getLocalizedValue(choice.label, languageCode),
      }));
  }, [elementChoices, languageCode]);

  // For the survey-ui component, we need to map labels to IDs
  const selectedValues = useMemo(() => {
    if (!value || !Array.isArray(value)) return [];

    const selected: string[] = [];
    value.forEach((val) => {
      // Backwards-compat: if value is already an option ID
      const idMatch = options.find((opt) => opt.id === val);
      if (idMatch) {
        selected.push(idMatch.id);
        return;
      }

      // Normal: value is a label
      const labelMatch = options.find((opt) => opt.label === val);
      if (labelMatch) selected.push(labelMatch.id);
    });

    return selected;
  }, [value, options]);

  // Handle selection changes - store labels directly instead of IDs
  const handleChange = (selectedIds: string[]) => {
    // Clear error when user changes ranking
    setErrorMessage(undefined);

    const nextLabels: string[] = [];
    selectedIds.forEach((id) => {
      const matchingOption = options.find((opt) => opt.id === id);
      if (matchingOption) nextLabels.push(matchingOption.label);
    });

    onChange({ [element.id]: nextLabels });

    const updatedTtcObj = getUpdatedTtc(ttc, element.id, performance.now() - startTime);
    setTtc(updatedTtcObj);
  };

  const validateRequired = (): boolean => {
    const isValueArray = Array.isArray(value);
    const allItemsRanked = isValueArray && value.length === element.choices.length;

    if ((element.required && !allItemsRanked) || (!element.required && value.length > 0 && !allItemsRanked)) {
      setErrorMessage(t("errors.please_rank_all_items_before_submitting"));
      return false;
    }

    return true;
  };

  const handleSubmit = (e: Event) => {
    e.preventDefault();
    if (!validateRequired()) return;

    const updatedTtcObj = getUpdatedTtc(ttc, element.id, performance.now() - startTime);
    setTtc(updatedTtcObj);
  };

  return (
    <form onSubmit={handleSubmit} className="w-full">
      <Ranking
        elementId={element.id}
        inputId={element.id}
        headline={getLocalizedValue(element.headline, languageCode)}
        description={element.subheader ? getLocalizedValue(element.subheader, languageCode) : undefined}
        options={options}
        value={selectedValues}
        onChange={handleChange}
        required={element.required}
        errorMessage={errorMessage}
        imageUrl={element.imageUrl}
        videoUrl={element.videoUrl}
      />
    </form>
  );
}
