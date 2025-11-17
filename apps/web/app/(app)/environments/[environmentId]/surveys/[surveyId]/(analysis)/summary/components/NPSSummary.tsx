"use client";

import { BarChart, BarChartHorizontal } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  TI18nString,
  TSurvey,
  TSurveyQuestionId,
  TSurveyQuestionSummaryNps,
  TSurveyQuestionTypeEnum,
} from "@formbricks/types/surveys/types";
import { HalfCircle, ProgressBar } from "@/modules/ui/components/progress-bar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/modules/ui/components/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/modules/ui/components/tooltip";
import { convertFloatToNDecimal } from "../lib/utils";
import { QuestionSummaryHeader } from "./QuestionSummaryHeader";
import { SatisfactionSmiley } from "./SatisfactionSmiley";

interface NPSSummaryProps {
  questionSummary: TSurveyQuestionSummaryNps;
  survey: TSurvey;
  setFilter: (
    questionId: TSurveyQuestionId,
    label: TI18nString,
    questionType: TSurveyQuestionTypeEnum,
    filterValue: string,
    filterComboBoxValue?: string | string[]
  ) => void;
}

export const NPSSummary = ({ questionSummary, survey, setFilter }: NPSSummaryProps) => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<"grouped" | "individual">("grouped");

  const applyFilter = (group: string) => {
    const filters = {
      promoters: {
        comparison: t("environments.surveys.summary.includes_either"),
        values: ["9", "10"],
      },
      passives: {
        comparison: t("environments.surveys.summary.includes_either"),
        values: ["7", "8"],
      },
      detractors: {
        comparison: t("environments.surveys.summary.is_less_than"),
        values: "7",
      },
      dismissed: {
        comparison: t("common.skipped"),
        values: undefined,
      },
    };

    const filter = filters[group];

    if (filter) {
      setFilter(
        questionSummary.question.id,
        questionSummary.question.headline,
        questionSummary.question.type,
        filter.comparison,
        filter.values
      );
    }
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <QuestionSummaryHeader
        questionSummary={questionSummary}
        survey={survey}
        additionalInfo={
          <TooltipProvider delayDuration={0}>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center space-x-2 rounded-lg bg-slate-100 p-2">
                  <SatisfactionSmiley percentage={questionSummary.promoters.percentage} />
                  <div>
                    % {t("environments.surveys.summary.promoters")}:{" "}
                    {convertFloatToNDecimal(questionSummary.promoters.percentage, 2)}%
                  </div>
                </div>
              </TooltipTrigger>
              <TooltipContent>{t("environments.surveys.summary.promotersTooltip")}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        }
      />

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "grouped" | "individual")}>
        <div className="flex justify-end px-4 md:px-6">
          <TabsList>
            <TabsTrigger value="grouped" icon={<BarChartHorizontal className="h-4 w-4" />}>
              {t("environments.surveys.summary.grouped")}
            </TabsTrigger>
            <TabsTrigger value="individual" icon={<BarChart className="h-4 w-4" />}>
              {t("environments.surveys.summary.individual")}
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="grouped" className="mt-4">
          <div className="space-y-5 px-4 pb-6 pt-4 text-sm md:px-6 md:text-base">
            {["promoters", "passives", "detractors", "dismissed"].map((group) => (
              <button
                className="w-full cursor-pointer hover:opacity-80"
                key={group}
                onClick={() => applyFilter(group)}>
                <div
                  className={`mb-2 flex justify-between ${group === "dismissed" ? "mb-2 border-t bg-white pt-4 text-sm md:text-base" : ""}`}>
                  <div className="mr-8 flex space-x-1">
                    <p
                      className={`font-semibold capitalize text-slate-700 ${group === "dismissed" ? "" : "text-slate-700"}`}>
                      {group}
                    </p>
                    <div>
                      <p className="rounded-lg bg-slate-100 px-2 text-slate-700">
                        {convertFloatToNDecimal(questionSummary[group]?.percentage, 2)}%
                      </p>
                    </div>
                  </div>
                  <p className="flex w-32 items-end justify-end text-slate-600">
                    {questionSummary[group]?.count}{" "}
                    {questionSummary[group]?.count === 1 ? t("common.response") : t("common.responses")}
                  </p>
                </div>
                <ProgressBar
                  barColor={group === "dismissed" ? "bg-slate-600" : "bg-brand-dark"}
                  progress={questionSummary[group]?.percentage / 100}
                />
              </button>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="individual" className="mt-4">
          <div className="grid grid-cols-11 gap-2 px-4 pb-6 pt-4 text-sm md:px-6 md:text-base">
            {questionSummary.choices.map((choice) => (
              <button
                key={choice.rating}
                className="flex cursor-pointer flex-col items-center space-y-2 hover:opacity-80"
                onClick={() =>
                  setFilter(
                    questionSummary.question.id,
                    questionSummary.question.headline,
                    questionSummary.question.type,
                    t("environments.surveys.summary.is_equal_to"),
                    choice.rating.toString()
                  )
                }>
                <div className="flex h-32 w-full flex-col items-center justify-end">
                  <div
                    className="bg-brand-dark w-full transition-all"
                    style={{ height: `${Math.max(choice.percentage, 2)}%` }}
                  />
                </div>
                <div className="text-center">
                  <div className="font-semibold text-slate-700">{choice.rating}</div>
                  <div className="text-xs text-slate-600">{choice.count}</div>
                  <div className="text-xs text-slate-500">
                    {convertFloatToNDecimal(choice.percentage, 1)}%
                  </div>
                </div>
              </button>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      <div className="flex justify-center pb-4 pt-4">
        <HalfCircle value={questionSummary.score} />
      </div>
    </div>
  );
};
