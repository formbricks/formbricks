"use client";

import { recallToHeadline } from "@/lib/utils/recall";
import { formatTextWithSlashes } from "@/modules/survey/editor/lib/utils";
import { getQuestionIcon } from "@/modules/survey/lib/questions";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/modules/ui/components/tooltip";
import { useTranslate } from "@tolgee/react";
import { TimerIcon } from "lucide-react";
import { TSurvey, TSurveyQuestionType, TSurveySummary } from "@formbricks/types/surveys/types";

interface SummaryDropOffsProps {
  dropOff: TSurveySummary["dropOff"];
  survey: TSurvey;
}

export const SummaryDropOffs = ({ dropOff, survey }: SummaryDropOffsProps) => {
  const { t } = useTranslate();
  const getIcon = (questionType: TSurveyQuestionType) => {
    const Icon = getQuestionIcon(questionType, t);
    return <Icon className="mt-[3px] h-5 w-5 shrink-0 text-slate-600" />;
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="">
        <div className="grid min-h-10 grid-cols-6 items-center rounded-t-xl border-b border-slate-200 bg-slate-100 text-sm font-semibold text-slate-600">
          <div className="col-span-3 px-4 md:px-6">{t("common.questions")}</div>
          <div className="flex justify-end px-4 md:px-6">
            <TooltipProvider delayDuration={50}>
              <Tooltip>
                <TooltipTrigger>
                  <TimerIcon className="h-5 w-5" />
                </TooltipTrigger>
                <TooltipContent side={"top"}>
                  <p className="text-center font-normal">{t("environments.surveys.summary.ttc_tooltip")}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <div className="px-4 text-right md:px-6">{t("environments.surveys.summary.impressions")}</div>
          <div className="px-4 text-right md:mr-1 md:pl-6 md:pr-20">
            {t("environments.surveys.summary.drop_offs")}
          </div>
        </div>
        {dropOff.map((quesDropOff) => (
          <div
            key={quesDropOff.questionId}
            className="grid grid-cols-6 items-start border-b border-slate-100 text-xs text-slate-800 md:text-sm">
            <div className="col-span-3 flex gap-3 px-4 py-2 md:px-6">
              {getIcon(quesDropOff.questionType)}
              <p>
                {formatTextWithSlashes(
                  recallToHeadline(
                    {
                      ["default"]: quesDropOff.headline,
                    },
                    survey,
                    true,
                    "default"
                  )["default"],
                  "@",
                  ["text-sm"]
                )}
              </p>
            </div>
            <div className="whitespace-pre-wrap px-4 py-2 text-right font-mono font-medium md:px-6">
              {quesDropOff.ttc > 0 ? (quesDropOff.ttc / 1000).toFixed(2) + "s" : "N/A"}
            </div>
            <div className="whitespace-pre-wrap px-4 py-2 text-right font-mono font-medium md:px-6">
              {quesDropOff.impressions}
            </div>
            <div className="px-4 py-2 text-right md:px-6">
              <span className="mr-1 font-mono font-medium">{quesDropOff.dropOffCount}</span>
              <span className="inline-block w-14 text-left text-sm">
                ({Math.round(quesDropOff.dropOffPercentage)}%)
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
