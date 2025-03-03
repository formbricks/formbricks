"use client";

import { ProgressBar } from "@/modules/ui/components/progress-bar";
import { useTranslate } from "@tolgee/react";
import { InboxIcon } from "lucide-react";
import Image from "next/image";
import {
  TI18nString,
  TSurvey,
  TSurveyQuestionId,
  TSurveyQuestionSummaryPictureSelection,
  TSurveyQuestionTypeEnum,
} from "@formbricks/types/surveys/types";
import { convertFloatToNDecimal } from "../lib/utils";
import { QuestionSummaryHeader } from "./QuestionSummaryHeader";

interface PictureChoiceSummaryProps {
  questionSummary: TSurveyQuestionSummaryPictureSelection;
  survey: TSurvey;
  setFilter: (
    questionId: TSurveyQuestionId,
    label: TI18nString,
    questionType: TSurveyQuestionTypeEnum,
    filterValue: string,
    filterComboBoxValue?: string | string[]
  ) => void;
}

export const PictureChoiceSummary = ({ questionSummary, survey, setFilter }: PictureChoiceSummaryProps) => {
  const results = questionSummary.choices;
  const { t } = useTranslate();
  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <QuestionSummaryHeader
        questionSummary={questionSummary}
        survey={survey}
        additionalInfo={
          questionSummary.question.allowMulti ? (
            <div className="flex items-center rounded-lg bg-slate-100 p-2">
              <InboxIcon className="mr-2 h-4 w-4" />
              {`${questionSummary.selectionCount} ${t("common.selections")}`}
            </div>
          ) : undefined
        }
      />
      <div className="space-y-5 px-4 pb-6 pt-4 text-sm md:px-6 md:text-base">
        {results.map((result, index) => (
          <div
            className="cursor-pointer hover:opacity-80"
            key={result.id}
            onClick={() =>
              setFilter(
                questionSummary.question.id,
                questionSummary.question.headline,
                questionSummary.question.type,
                t("environments.surveys.summary.includes_all"),
                [`${t("environments.surveys.edit.picture_idx", { idx: index + 1 })}`]
              )
            }>
            <div className="text flex flex-col justify-between px-2 pb-2 sm:flex-row">
              <div className="mr-8 flex w-full justify-between space-x-1 sm:justify-normal">
                <div className="relative h-32 w-[220px]">
                  <Image
                    src={result.imageUrl}
                    alt="choice-image"
                    layout="fill"
                    objectFit="cover"
                    className="rounded-md"
                  />
                </div>
                <div className="self-end">
                  <p className="rounded-lg bg-slate-100 px-2 text-slate-700">
                    {convertFloatToNDecimal(result.percentage, 2)}%
                  </p>
                </div>
              </div>
              <p className="flex w-full pt-1 text-slate-600 sm:items-end sm:justify-end sm:pt-0">
                {result.count} {result.count === 1 ? t("common.selection") : t("common.selections")}
              </p>
            </div>
            <ProgressBar barColor="bg-brand-dark" progress={result.percentage / 100 || 0} />
          </div>
        ))}
      </div>
    </div>
  );
};
