"use client";

import { convertFloatToNDecimal } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/lib/utils";
import { ProgressBar } from "@/modules/ui/components/progress-bar";
import { useTranslate } from "@tolgee/react";
import { TSurvey, TSurveyQuestionSummaryCal } from "@formbricks/types/surveys/types";
import { QuestionSummaryHeader } from "./QuestionSummaryHeader";

interface CalSummaryProps {
  questionSummary: TSurveyQuestionSummaryCal;
  environmentId: string;
  survey: TSurvey;
}

export const CalSummary = ({ questionSummary, survey }: CalSummaryProps) => {
  const { t } = useTranslate();

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-xs">
      <QuestionSummaryHeader questionSummary={questionSummary} survey={survey} />
      <div className="space-y-5 px-4 pt-4 pb-6 text-sm md:px-6 md:text-base">
        <div>
          <div className="text flex justify-between px-2 pb-2">
            <div className="mr-8 flex space-x-1">
              <p className="font-semibold text-slate-700">{t("common.booked")}</p>
              <div>
                <p className="rounded-lg bg-slate-100 px-2 text-slate-700">
                  {convertFloatToNDecimal(questionSummary.booked.percentage, 2)}%
                </p>
              </div>
            </div>
            <p className="flex w-32 items-end justify-end text-slate-600">
              {questionSummary.booked.count}{" "}
              {questionSummary.booked.count === 1 ? t("common.response") : t("common.responses")}
            </p>
          </div>
          <ProgressBar barColor="bg-brand-dark" progress={questionSummary.booked.percentage / 100} />
        </div>
        <div>
          <div className="text flex justify-between px-2 pb-2">
            <div className="mr-8 flex space-x-1">
              <p className="font-semibold text-slate-700">{t("common.dismissed")}</p>
              <div>
                <p className="rounded-lg bg-slate-100 px-2 text-slate-700">
                  {convertFloatToNDecimal(questionSummary.skipped.percentage, 2)}%
                </p>
              </div>
            </div>
            <p className="flex w-32 items-end justify-end text-slate-600">
              {questionSummary.skipped.count}{" "}
              {questionSummary.skipped.count === 1 ? t("common.response") : t("common.responses")}
            </p>
          </div>
          <ProgressBar barColor="bg-brand-dark" progress={questionSummary.skipped.percentage / 100} />
        </div>
      </div>
    </div>
  );
};
