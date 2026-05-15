"use client";

import { InboxIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { TSurvey, TSurveyElementSummaryCta } from "@formbricks/types/surveys/types";
import { ProgressBar } from "@/modules/ui/components/progress-bar";
import { convertFloatToNDecimal } from "../lib/utils";
import { ElementSummaryHeader } from "./ElementSummaryHeader";

interface CTASummaryProps {
  elementSummary: TSurveyElementSummaryCta;
  survey: TSurvey;
}

export const CTASummary = ({ elementSummary, survey }: CTASummaryProps) => {
  const { t } = useTranslation();

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <ElementSummaryHeader
        survey={survey}
        elementSummary={elementSummary}
        showResponses={false}
        additionalInfo={
          <>
            <div className="flex items-center rounded-lg bg-slate-100 p-2">
              <InboxIcon className="mr-2 h-4 w-4" />
              {`${elementSummary.impressionCount} ${t("common.impressions")}`}
            </div>
            <div className="flex items-center rounded-lg bg-slate-100 p-2">
              <InboxIcon className="mr-2 h-4 w-4" />
              {`${elementSummary.clickCount} ${t("common.clicks")}`}
            </div>
            {!elementSummary.element.required && (
              <div className="flex items-center rounded-lg bg-slate-100 p-2">
                <InboxIcon className="mr-2 h-4 w-4" />
                {`${elementSummary.skipCount} ${t("common.skips")}`}
              </div>
            )}
          </>
        }
      />
      <div className="space-y-5 px-4 pb-6 pt-4 text-sm md:px-6 md:text-base">
        <div className="text flex justify-between px-2 pb-2">
          <div className="mr-8 flex space-x-1">
            <p className="font-semibold text-slate-700">CTR</p>
            <div>
              <p className="rounded-lg bg-slate-100 px-2 text-slate-700">
                {convertFloatToNDecimal(elementSummary.ctr.percentage, 2)}%
              </p>
            </div>
          </div>
          <p className="flex w-32 items-end justify-end text-slate-600">
            {elementSummary.ctr.count}{" "}
            {elementSummary.ctr.count === 1 ? t("common.click") : t("common.clicks")}
          </p>
        </div>
        <ProgressBar barColor="bg-brand-dark" progress={elementSummary.ctr.percentage / 100} />
      </div>
    </div>
  );
};
