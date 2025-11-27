"use client";

import { InboxIcon } from "lucide-react";
import Image from "next/image";
import { useTranslation } from "react-i18next";
import { type TI18nString } from "@formbricks/types/i18n";
import { TSurveyElementTypeEnum } from "@formbricks/types/surveys/elements";
import { TSurvey, TSurveyElementSummaryPictureSelection } from "@formbricks/types/surveys/types";
import { getChoiceIdByValue } from "@/lib/response/utils";
import { IdBadge } from "@/modules/ui/components/id-badge";
import { ProgressBar } from "@/modules/ui/components/progress-bar";
import { convertFloatToNDecimal } from "../lib/utils";
import { ElementSummaryHeader } from "./ElementSummaryHeader";

interface PictureChoiceSummaryProps {
  elementSummary: TSurveyElementSummaryPictureSelection;
  survey: TSurvey;
  setFilter: (
    elementId: string,
    label: TI18nString,
    elementType: TSurveyElementTypeEnum,
    filterValue: string,
    filterComboBoxValue?: string | string[]
  ) => void;
}

export const PictureChoiceSummary = ({ elementSummary, survey, setFilter }: PictureChoiceSummaryProps) => {
  const results = elementSummary.choices;
  const { t } = useTranslation();

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <ElementSummaryHeader
        elementSummary={elementSummary}
        survey={survey}
        additionalInfo={
          elementSummary.element.allowMulti ? (
            <div className="flex items-center rounded-lg bg-slate-100 p-2">
              <InboxIcon className="mr-2 h-4 w-4" />
              {`${elementSummary.selectionCount} ${t("common.selections")}`}
            </div>
          ) : undefined
        }
      />
      <div className="space-y-5 px-4 pb-6 pt-4 text-sm md:px-6 md:text-base">
        {results.map((result, index) => {
          const choiceId = getChoiceIdByValue(result.imageUrl, elementSummary.element);
          return (
            <button
              type="button"
              className="w-full cursor-pointer hover:opacity-80"
              key={result.id}
              onClick={() =>
                setFilter(
                  elementSummary.element.id,
                  elementSummary.element.headline,
                  elementSummary.element.type,
                  t("environments.surveys.summary.includes_all"),
                  [`${t("environments.surveys.edit.picture_idx", { idx: index + 1 })}`]
                )
              }>
              <div className="text flex flex-col justify-between px-2 pb-2 sm:flex-row">
                <div className="mr-8 flex w-full justify-between space-x-2 sm:justify-normal">
                  <div className="relative h-32 w-[220px]">
                    <Image
                      src={result.imageUrl}
                      alt="choice-image"
                      layout="fill"
                      objectFit="cover"
                      className="rounded-md"
                    />
                  </div>
                  <div className="self-end">{choiceId && <IdBadge id={choiceId} />}</div>
                </div>
                <div className="flex w-full space-x-2">
                  <p className="flex w-full pt-1 text-slate-600 sm:items-end sm:justify-end sm:pt-0">
                    {result.count} {result.count === 1 ? t("common.selection") : t("common.selections")}
                  </p>
                  <p className="self-end rounded-lg bg-slate-100 px-2 text-slate-700">
                    {convertFloatToNDecimal(result.percentage, 2)}%
                  </p>
                </div>
              </div>
              <ProgressBar barColor="bg-brand-dark" progress={result.percentage / 100 || 0} />
            </button>
          );
        })}
      </div>
    </div>
  );
};
