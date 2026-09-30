"use client";

import { InboxIcon } from "lucide-react";
import { Fragment, type KeyboardEvent } from "react";
import { useTranslation } from "react-i18next";
import { TI18nString } from "@formbricks/types/i18n";
import { TSurveyElementTypeEnum } from "@formbricks/types/surveys/elements";
import { TSurvey, TSurveyElementSummaryMultipleChoice, TSurveyType } from "@formbricks/types/surveys/types";
import { getChoiceIdByValue } from "@/lib/response/utils";
import { IdBadge } from "@/modules/ui/components/id-badge";
import { ProgressBar } from "@/modules/ui/components/progress-bar";
import { convertFloatToNDecimal } from "../lib/utils";
import { ElementSummaryHeader } from "./ElementSummaryHeader";
import { OtherValuesList } from "./OtherValuesList";

interface MultipleChoiceSummaryProps {
  elementSummary: TSurveyElementSummaryMultipleChoice;
  surveyType: TSurveyType;
  survey: TSurvey;
  setFilter: (
    elementId: string,
    label: TI18nString,
    elementType: TSurveyElementTypeEnum,
    filterValue: string,
    filterComboBoxValue?: string | string[]
  ) => void;
}

type ChoiceSummaryResult = TSurveyElementSummaryMultipleChoice["choices"][number];

export const MultipleChoiceSummary = ({
  elementSummary,
  surveyType,
  survey,
  setFilter,
}: MultipleChoiceSummaryProps) => {
  const { t } = useTranslation();
  const otherValue = elementSummary.element.choices.find((choice) => choice.id === "other")?.label.default;
  // sort by count and transform to array
  const results = Object.values(elementSummary.choices).sort((a, b) => {
    const aHasOthers = (a.others?.length ?? 0) > 0;
    const bHasOthers = (b.others?.length ?? 0) > 0;

    // if one has “others” and the other doesn’t, push the one with others to the end
    if (aHasOthers && !bHasOthers) return 1;
    if (!aHasOthers && bHasOthers) return -1;

    // if they’re “tied” on having others, fall back to count
    return b.count - a.count;
  });

  const applyChoiceFilter = (result: ChoiceSummaryResult) => {
    setFilter(
      elementSummary.element.id,
      elementSummary.element.headline,
      elementSummary.element.type,
      elementSummary.type === TSurveyElementTypeEnum.MultipleChoiceSingle || otherValue === result.value
        ? t("workspace.surveys.summary.includes_either")
        : t("workspace.surveys.summary.includes_all"),
      [result.value]
    );
  };

  const handleChoiceKeyDown = (event: KeyboardEvent<HTMLDivElement>, result: ChoiceSummaryResult) => {
    if (event.target !== event.currentTarget || (event.key !== "Enter" && event.key !== " ")) {
      return;
    }

    event.preventDefault();
    applyChoiceFilter(result);
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-xs">
      <ElementSummaryHeader
        elementSummary={elementSummary}
        survey={survey}
        additionalInfo={
          elementSummary.type === "multipleChoiceMulti" ? (
            <div className="flex items-center rounded-lg bg-slate-100 p-2">
              <InboxIcon className="mr-2 size-4" />
              {t("common.count_selections", { count: elementSummary.selectionCount })}
            </div>
          ) : undefined
        }
      />
      <div className="px-4 pt-4 pb-6 text-sm md:px-6 md:text-base">
        <div className="space-y-5">
          {results.map((result) => {
            const choiceId = getChoiceIdByValue(result.value, elementSummary.element);
            return (
              <Fragment key={result.value}>
                <div
                  role="button"
                  tabIndex={0}
                  className="group w-full cursor-pointer"
                  onClick={() => applyChoiceFilter(result)}
                  onKeyDown={(event) => handleChoiceKeyDown(event, result)}>
                  <div className="text flex flex-col justify-between px-2 pb-2 sm:flex-row">
                    <div className="mr-8 flex w-full justify-between gap-x-2 sm:justify-normal">
                      <p className="font-semibold text-slate-700 underline-offset-4 group-hover:underline">
                        {result.value}
                      </p>
                      {choiceId && <IdBadge id={choiceId} />}
                    </div>
                    <div className="flex w-full gap-x-2">
                      <p className="flex w-full pt-1 text-slate-600 sm:items-end sm:justify-end sm:pt-0">
                        {t("common.count_selections", { count: result.count })}
                      </p>
                      <p className="rounded-lg bg-slate-100 px-2 text-slate-700">
                        {convertFloatToNDecimal(result.percentage, 2)}%
                      </p>
                    </div>
                  </div>
                  <div className="group-hover:opacity-80">
                    <ProgressBar barColor="bg-brand-dark" progress={result.percentage / 100} />
                  </div>
                </div>
                {result.others && result.others.length > 0 && (
                  <OtherValuesList others={result.others} surveyType={surveyType} />
                )}
              </Fragment>
            );
          })}
        </div>
      </div>
    </div>
  );
};
