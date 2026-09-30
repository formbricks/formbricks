import { useMemo, useState } from "preact/hooks";
import { useTranslation } from "react-i18next";
import { Ranking, type RankingOption } from "@formbricks/survey-ui";
import { type TResponseData, type TResponseTtc } from "@formbricks/types/responses";
import type { TSurveyRankingElement } from "@formbricks/types/surveys/elements";
import { getLocalizedValue } from "@/lib/i18n";
import { rankingValueToSelection, selectionToRankingValue } from "@/lib/ranking";
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
  errorMessage?: string;
  dir?: "ltr" | "rtl" | "auto";
}

export function RankingElement({
  element,
  value,
  onChange,
  languageCode,
  ttc,
  setTtc,
  currentElementId,
  errorMessage,
  dir = "auto",
}: Readonly<RankingElementProps>) {
  const [startTime, setStartTime] = useState(performance.now());
  const isCurrent = element.id === currentElementId;
  const isRequired = element.required;
  const { t } = useTranslation();

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

  const otherOptionId = element.choices.some((choice) => choice.id === "other") ? "other" : undefined;

  // Stored value is labels in rank order, with the "Other" slot holding the respondent's own text.
  const { selectedIds, otherValue } = useMemo(
    () => rankingValueToSelection(Array.isArray(value) ? value : [], options, otherOptionId),
    [value, options, otherOptionId]
  );

  const updateValue = (nextSelectedIds: string[], nextOtherValue: string) => {
    onChange({
      [element.id]: selectionToRankingValue(nextSelectedIds, options, otherOptionId, nextOtherValue),
    });

    const updatedTtcObj = getUpdatedTtc(ttc, element.id, performance.now() - startTime);
    setTtc(updatedTtcObj);
  };

  const handleChange = (nextSelectedIds: string[]) => {
    // Un-ranking "Other" discards its text, so ranking it again starts from an empty box.
    const keepsOther = otherOptionId !== undefined && nextSelectedIds.includes(otherOptionId);
    updateValue(nextSelectedIds, keepsOther ? otherValue : "");
  };

  const handleOtherValueChange = (nextOtherValue: string) => {
    updateValue(selectedIds, nextOtherValue);
  };

  const otherOptionPlaceholder = element.otherOptionPlaceholder
    ? getLocalizedValue(element.otherOptionPlaceholder, languageCode)
    : "";

  const handleSubmit = (e: Event) => {
    e.preventDefault();
    // Update TTC when form is submitted (for TTC collection)
    const updatedTtcObj = getUpdatedTtc(ttc, element.id, performance.now() - startTime);
    setTtc(updatedTtcObj);
  };

  return (
    <form onSubmit={handleSubmit} className="w-full">
      <Ranking
        dir={dir}
        elementId={element.id}
        inputId={element.id}
        headline={getLocalizedValue(element.headline, languageCode)}
        description={element.subheader ? getLocalizedValue(element.subheader, languageCode) : undefined}
        options={options}
        value={selectedIds}
        onChange={handleChange}
        otherOptionId={otherOptionId}
        otherOptionPlaceholder={otherOptionPlaceholder || "Please specify"}
        otherValue={otherValue}
        onOtherValueChange={handleOtherValueChange}
        required={isRequired}
        requiredLabel={t("common.required")}
        errorMessage={errorMessage}
        imageUrl={element.imageUrl}
        videoUrl={element.videoUrl}
      />
    </form>
  );
}
