"use client";

import { BarChart, BarChartHorizontal } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { type TI18nString } from "@formbricks/types/i18n";
import { TSurveyElementTypeEnum } from "@formbricks/types/surveys/elements";
import { TSurvey, TSurveyElementSummaryNps } from "@formbricks/types/surveys/types";
import { HalfCircle, ProgressBar } from "@/modules/ui/components/progress-bar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/modules/ui/components/tabs";
import { TooltipProvider } from "@/modules/ui/components/tooltip";
import { convertFloatToNDecimal } from "../lib/utils";
import { ClickableBarSegment } from "./ClickableBarSegment";
import { ElementSummaryHeader } from "./ElementSummaryHeader";
import { SatisfactionIndicator } from "./SatisfactionIndicator";

interface NPSSummaryProps {
  elementSummary: TSurveyElementSummaryNps;
  survey: TSurvey;
  setFilter: (
    elementId: string,
    label: TI18nString,
    elementType: TSurveyElementTypeEnum,
    filterValue: string,
    filterComboBoxValue?: string | string[]
  ) => void;
}

const calculateNPSOpacity = (rating: number): number => {
  if (rating <= 6) {
    return 0.3 + (rating / 6) * 0.3;
  }
  if (rating <= 8) {
    return 0.6 + ((rating - 6) / 2) * 0.2;
  }
  return 0.8 + ((rating - 8) / 2) * 0.2;
};

export const NPSSummary = ({ elementSummary, survey, setFilter }: NPSSummaryProps) => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<"aggregated" | "individual">("aggregated");

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
        elementSummary.element.id,
        elementSummary.element.headline,
        elementSummary.element.type,
        filter.comparison,
        filter.values
      );
    }
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <ElementSummaryHeader
        elementSummary={elementSummary}
        survey={survey}
        additionalInfo={
          <div className="flex items-center space-x-2 rounded-lg bg-slate-100 p-2">
            <SatisfactionIndicator percentage={elementSummary.promoters.percentage} />
            <div>
              {t("environments.surveys.summary.promoters")}:{" "}
              {convertFloatToNDecimal(elementSummary.promoters.percentage, 2)}%
            </div>
          </div>
        }
      />

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "aggregated" | "individual")}>
        <div className="flex justify-end px-4 md:px-6">
          <TabsList>
            <TabsTrigger value="aggregated" icon={<BarChartHorizontal className="h-4 w-4" />}>
              {t("environments.surveys.summary.aggregated")}
            </TabsTrigger>
            <TabsTrigger value="individual" icon={<BarChart className="h-4 w-4" />}>
              {t("environments.surveys.summary.individual")}
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="aggregated" className="mt-4">
          <div className="px-4 pb-6 pt-4 md:px-6">
            <div className="space-y-5 text-sm md:text-base">
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
                          {convertFloatToNDecimal(elementSummary[group]?.percentage, 2)}%
                        </p>
                      </div>
                    </div>
                    <p className="flex w-32 items-end justify-end text-slate-600">
                      {elementSummary[group]?.count}{" "}
                      {elementSummary[group]?.count === 1 ? t("common.response") : t("common.responses")}
                    </p>
                  </div>
                  <ProgressBar
                    barColor={group === "dismissed" ? "bg-slate-600" : "bg-brand-dark"}
                    progress={elementSummary[group]?.percentage / 100}
                  />
                </button>
              ))}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="individual" className="mt-4">
          <TooltipProvider delayDuration={200}>
            <div className="grid grid-cols-11 gap-2 px-4 pb-6 pt-4 text-sm md:px-6 md:text-base">
              {elementSummary.choices.map((choice) => {
                const opacity = calculateNPSOpacity(choice.rating);

                return (
                  <ClickableBarSegment
                    key={choice.rating}
                    className="group flex cursor-pointer flex-col items-center"
                    onClick={() =>
                      setFilter(
                        elementSummary.element.id,
                        elementSummary.element.headline,
                        elementSummary.element.type,
                        t("environments.surveys.summary.is_equal_to"),
                        choice.rating.toString()
                      )
                    }>
                    <div className="flex h-32 w-full flex-col items-center justify-end">
                      <div
                        className="bg-brand-dark w-full rounded-t-lg border border-slate-200 transition-all group-hover:brightness-110"
                        style={{
                          height: `${Math.max(choice.percentage, 2)}%`,
                          opacity,
                        }}
                      />
                    </div>
                    <div className="flex w-full flex-col items-center rounded-b-lg border border-t-0 border-slate-200 bg-slate-50 px-1 py-2">
                      <div className="mb-1.5 text-xs font-medium text-slate-500">{choice.rating}</div>
                      <div className="mb-1 flex items-center space-x-1">
                        <div className="text-base font-semibold text-slate-700">{choice.count}</div>
                        <div className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600">
                          {convertFloatToNDecimal(choice.percentage, 1)}%
                        </div>
                      </div>
                    </div>
                  </ClickableBarSegment>
                );
              })}
            </div>
          </TooltipProvider>
        </TabsContent>
      </Tabs>

      <div className="flex justify-center pb-4 pt-4">
        <HalfCircle value={elementSummary.score} />
      </div>
    </div>
  );
};
