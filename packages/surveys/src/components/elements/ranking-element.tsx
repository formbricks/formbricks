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

  // Convert value from array of labels to array of IDs
  const convertValueToIds = (valueArray: string[] | undefined): string[] => {
    if (!Array.isArray(valueArray)) return [];

    // Map labels back to IDs based on the current element choices
    const idArray: string[] = [];
    valueArray.forEach((label) => {
      const matchingChoice = elementChoices.find(
        (choice) => choice && getLocalizedValue(choice.label, languageCode) === label
      );
      if (matchingChoice) {
        idArray.push(matchingChoice.id);
      }
    });

    return idArray;
  };

  // Convert value from array of IDs back to array of labels for onChange
  const convertValueFromIds = (idArray: string[]): string[] => {
    return idArray.map((id) => {
      const matchingChoice = elementChoices.find((choice) => choice?.id === id);
      return matchingChoice ? getLocalizedValue(matchingChoice.label, languageCode) : "";
    });
  };

  const handleChange = (newValue: string[]) => {
    // Clear error when user changes ranking
    setErrorMessage(undefined);

    const labelValue = convertValueFromIds(newValue);
    onChange({ [element.id]: labelValue });
  };

  const validateRequired = (): boolean => {
    if (element.required && (!Array.isArray(value) || value.length === 0)) {
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
    <form onSubmit={handleSubmit} className="fb:w-full">
      <Ranking
        elementId={element.id}
        inputId={element.id}
        headline={getLocalizedValue(element.headline, languageCode)}
        description={element.subheader ? getLocalizedValue(element.subheader, languageCode) : undefined}
        options={options}
        value={convertValueToIds(value)}
        onChange={handleChange}
        required={element.required}
        errorMessage={errorMessage}
      />
    </form>
  );
}
