"use client";

import { ProgressBar } from "@/modules/ui/components/progress-bar";
import { useTranslate } from "@tolgee/react";
import {
  TI18nString,
  TSurvey,
  TSurveyQuestionId,
  TSurveyQuestionSummaryConsent,
  TSurveyQuestionTypeEnum,
} from "@formbricks/types/surveys/types";
import { convertFloatToNDecimal } from "../lib/utils";
import { QuestionSummaryHeader } from "./QuestionSummaryHeader";

interface ConsentSummaryProps {
  questionSummary: TSurveyQuestionSummaryConsent;
  survey: TSurvey;
  setFilter: (
    questionId: TSurveyQuestionId,
    label: TI18nString,
    questionType: TSurveyQuestionTypeEnum,
    filterValue: string,
    filterComboBoxValue?: string | string[]
  ) => void;
}

export const ConsentSummary = ({ questionSummary, survey, setFilter }: ConsentSummaryProps) => {
  const { t } = useTranslate();
  const summaryItems = [
    {
      title: t("common.accepted"),
      percentage: questionSummary.accepted.percentage,
      count: questionSummary.accepted.count,
    },
    {
      title: t("common.dismissed"),
      percentage: questionSummary.dismissed.percentage,
      count: questionSummary.dismissed.count,
    },
  ];
  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-xs">
      <QuestionSummaryHeader questionSummary={questionSummary} survey={survey} />
      <div className="space-y-5 px-4 pt-4 pb-6 text-sm md:px-6 md:text-base">
        {summaryItems.map((summaryItem) => {
          return (
            <div
              className="group cursor-pointer"
              key={summaryItem.title}
              onClick={() =>
                setFilter(
                  questionSummary.question.id,
                  questionSummary.question.headline,
                  questionSummary.question.type,
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
            </div>
          );
        })}
      </div>
    </div>
  );
};
