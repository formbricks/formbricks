"use client";

import { useTranslation } from "react-i18next";
import { type TI18nString } from "@formbricks/types/i18n";
import { TSurveyElementTypeEnum } from "@formbricks/types/surveys/elements";
import { TSurvey, TSurveyElementSummaryConsent } from "@formbricks/types/surveys/types";
import { ProgressBar } from "@/modules/ui/components/progress-bar";
import { convertFloatToNDecimal } from "../lib/utils";
import { ElementSummaryHeader } from "./ElementSummaryHeader";

interface ConsentSummaryProps {
  elementSummary: TSurveyElementSummaryConsent;
  survey: TSurvey;
  setFilter: (
    elementId: string,
    label: TI18nString,
    elementType: TSurveyElementTypeEnum,
    filterValue: string,
    filterComboBoxValue?: string | string[]
  ) => void;
}

export const ConsentSummary = ({ elementSummary, survey, setFilter }: ConsentSummaryProps) => {
  const { t } = useTranslation();
  const summaryItems = [
    {
      title: t("common.accepted"),
      percentage: elementSummary.accepted.percentage,
      count: elementSummary.accepted.count,
    },
    {
      title: t("common.dismissed"),
      percentage: elementSummary.dismissed.percentage,
      count: elementSummary.dismissed.count,
    },
  ];
  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <ElementSummaryHeader elementSummary={elementSummary} survey={survey} />
      <div className="space-y-5 px-4 pb-6 pt-4 text-sm md:px-6 md:text-base">
        {summaryItems.map((summaryItem) => {
          return (
            <button
              className="group w-full cursor-pointer"
              key={summaryItem.title}
              onClick={() =>
                setFilter(
                  elementSummary.element.id,
                  elementSummary.element.headline,
                  elementSummary.element.type,
                  "is",
                  summaryItem.title
                )
              }>
              <div className="text flex justify-between px-2 pb-2">
                <div className="mr-8 flex space-x-1">
                  <p className="font-semibold text-slate-700 underline-offset-4 group-hover:underline">
                    {summaryItem.title}
                  </p>
                  <div>
                    <p className="rounded-lg bg-slate-100 px-2 text-slate-700">
                      {convertFloatToNDecimal(summaryItem.percentage, 2)}%
                    </p>
                  </div>
                </div>
                <p className="flex w-32 items-end justify-end text-slate-600">
                  {summaryItem.count} {summaryItem.count === 1 ? t("common.response") : t("common.responses")}
                </p>
              </div>
              <div className="group-hover:opacity-80">
                <ProgressBar barColor="bg-brand-dark" progress={summaryItem.percentage / 100} />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
