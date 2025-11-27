"use client";

import { useTranslation } from "react-i18next";
import { TSurvey, TSurveyElementSummaryCal } from "@formbricks/types/surveys/types";
import { convertFloatToNDecimal } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/lib/utils";
import { ProgressBar } from "@/modules/ui/components/progress-bar";
import { ElementSummaryHeader } from "./ElementSummaryHeader";

interface CalSummaryProps {
  elementSummary: TSurveyElementSummaryCal;
  environmentId: string;
  survey: TSurvey;
}

export const CalSummary = ({ elementSummary, survey }: CalSummaryProps) => {
  const { t } = useTranslation();

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <ElementSummaryHeader elementSummary={elementSummary} survey={survey} />
      <div className="space-y-5 px-4 pb-6 pt-4 text-sm md:px-6 md:text-base">
        <div>
          <div className="text flex justify-between px-2 pb-2">
            <div className="mr-8 flex space-x-1">
              <p className="font-semibold text-slate-700">{t("common.booked")}</p>
              <div>
                <p className="rounded-lg bg-slate-100 px-2 text-slate-700">
                  {convertFloatToNDecimal(elementSummary.booked.percentage, 2)}%
                </p>
              </div>
            </div>
            <p className="flex w-32 items-end justify-end text-slate-600">
              {elementSummary.booked.count}{" "}
              {elementSummary.booked.count === 1 ? t("common.response") : t("common.responses")}
            </p>
          </div>
          <ProgressBar barColor="bg-brand-dark" progress={elementSummary.booked.percentage / 100} />
        </div>
        <div>
          <div className="text flex justify-between px-2 pb-2">
            <div className="mr-8 flex space-x-1">
              <p className="font-semibold text-slate-700">{t("common.dismissed")}</p>
              <div>
                <p className="rounded-lg bg-slate-100 px-2 text-slate-700">
                  {convertFloatToNDecimal(elementSummary.skipped.percentage, 2)}%
                </p>
              </div>
            </div>
            <p className="flex w-32 items-end justify-end text-slate-600">
              {elementSummary.skipped.count}{" "}
              {elementSummary.skipped.count === 1 ? t("common.response") : t("common.responses")}
            </p>
          </div>
          <ProgressBar barColor="bg-brand-dark" progress={elementSummary.skipped.percentage / 100} />
        </div>
      </div>
    </div>
  );
};
