"use client";

import { BarChart, BarChartHorizontal, CircleSlash2, SmileIcon, StarIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { type TI18nString } from "@formbricks/types/i18n";
import { TSurveyElementTypeEnum } from "@formbricks/types/surveys/elements";
import { TSurvey, TSurveyElementSummaryRating } from "@formbricks/types/surveys/types";
import { convertFloatToNDecimal } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/lib/utils";
import { EmptyState } from "@/modules/ui/components/empty-state";
import { ProgressBar } from "@/modules/ui/components/progress-bar";
import { RatingResponse } from "@/modules/ui/components/rating-response";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/modules/ui/components/tabs";
import { TooltipProvider } from "@/modules/ui/components/tooltip";
import { ClickableBarSegment } from "./ClickableBarSegment";
import { ElementSummaryHeader } from "./ElementSummaryHeader";
import { RatingScaleLegend } from "./RatingScaleLegend";
import { SatisfactionIndicator } from "./SatisfactionIndicator";

interface RatingSummaryProps {
  elementSummary: TSurveyElementSummaryRating;
  survey: TSurvey;
  setFilter: (
    elementId: string,
    label: TI18nString,
    elementType: TSurveyElementTypeEnum,
    filterValue: string,
    filterComboBoxValue?: string | string[]
  ) => void;
}

export const RatingSummary = ({ elementSummary, survey, setFilter }: RatingSummaryProps) => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<"aggregated" | "individual">("aggregated");

  const getIconBasedOnScale = useMemo(() => {
    const scale = elementSummary.element.scale;
    if (scale === "number") return <CircleSlash2 className="h-4 w-4" />;
    else if (scale === "star") return <StarIcon fill="rgb(250 204 21)" className="h-4 w-4 text-yellow-400" />;
    else if (scale === "smiley") return <SmileIcon className="h-4 w-4" />;
  }, [elementSummary]);

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <ElementSummaryHeader
        elementSummary={elementSummary}
        survey={survey}
        additionalInfo={
          <div className="flex items-center space-x-2">
            <div className="flex items-center space-x-2 rounded-lg bg-slate-100 p-2">
              {getIconBasedOnScale}
              <div>
                {t("environments.surveys.summary.overall")}: {elementSummary.average.toFixed(2)}
              </div>
            </div>

            <div className="flex items-center space-x-2 rounded-lg bg-slate-100 p-2">
              <SatisfactionIndicator percentage={elementSummary.csat.satisfiedPercentage} />
              <div>
                CSAT: {elementSummary.csat.satisfiedPercentage}% {t("environments.surveys.summary.satisfied")}
              </div>
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
            {elementSummary.responseCount === 0 ? (
              <>
                <EmptyState text={t("environments.surveys.summary.no_responses_found")} variant="simple" />
                <RatingScaleLegend
                  scale={elementSummary.element.scale}
                  range={elementSummary.element.range}
                />
              </>
            ) : (
              <>
                <TooltipProvider delayDuration={200}>
                  <div className="flex h-12 w-full overflow-hidden rounded-t-lg border border-slate-200">
                    {elementSummary.choices.map((result, index) => {
                      if (result.percentage === 0) return null;

                      const range = elementSummary.element.range;
                      const opacity = 0.3 + (result.rating / range) * 0.8;
                      const isFirst = index === 0;
                      const isLast = index === elementSummary.choices.length - 1;

                      return (
                        <ClickableBarSegment
                          key={result.rating}
                          className="relative h-full cursor-pointer transition-opacity hover:brightness-110"
                          style={{
                            width: `${result.percentage}%`,
                            borderRight: isLast ? "none" : "1px solid rgb(226, 232, 240)",
                          }}
                          onClick={() =>
                            setFilter(
                              elementSummary.element.id,
                              elementSummary.element.headline,
                              elementSummary.element.type,
                              t("environments.surveys.summary.is_equal_to"),
                              result.rating.toString()
                            )
                          }>
                          <div
                            className={`bg-brand-dark h-full ${isFirst ? "rounded-tl-lg" : ""} ${isLast ? "rounded-tr-lg" : ""}`}
                            style={{ opacity }}
                          />
                        </ClickableBarSegment>
                      );
                    })}
                  </div>
                </TooltipProvider>
                <div className="flex w-full overflow-hidden rounded-b-lg border border-t-0 border-slate-200 bg-slate-50">
                  {elementSummary.choices.map((result, index) => {
                    if (result.percentage === 0) return null;

                    return (
                      <div
                        key={result.rating}
                        className="flex flex-col items-center justify-center py-2"
                        style={{
                          width: `${result.percentage}%`,
                          borderRight:
                            index < elementSummary.choices.length - 1
                              ? "1px solid rgb(226, 232, 240)"
                              : "none",
                        }}>
                        <div className="mb-1 flex items-center justify-center">
                          <RatingResponse
                            scale={elementSummary.element.scale}
                            answer={result.rating}
                            range={elementSummary.element.range}
                            addColors={false}
                            variant="aggregated"
                          />
                        </div>
                        <div className="text-xs font-medium text-slate-600">
                          {convertFloatToNDecimal(result.percentage, 1)}%
                        </div>
                      </div>
                    );
                  })}
                </div>
                <RatingScaleLegend
                  scale={elementSummary.element.scale}
                  range={elementSummary.element.range}
                />
              </>
            )}
          </div>
        </TabsContent>

        <TabsContent value="individual" className="mt-4">
          <div className="px-4 pb-6 pt-4 md:px-6">
            <div className="space-y-5 text-sm md:text-base">
              {elementSummary.choices.map((result) => (
                <div key={result.rating}>
                  <button
                    className="w-full cursor-pointer hover:opacity-80"
                    onClick={() =>
                      setFilter(
                        elementSummary.element.id,
                        elementSummary.element.headline,
                        elementSummary.element.type,
                        t("environments.surveys.summary.is_equal_to"),
                        result.rating.toString()
                      )
                    }>
                    <div className="text flex justify-between px-2 pb-2">
                      <div className="mr-8 flex items-center space-x-1">
                        <div className="font-semibold text-slate-700">
                          <RatingResponse
                            scale={elementSummary.element.scale}
                            answer={result.rating}
                            range={elementSummary.element.range}
                            addColors={elementSummary.element.isColorCodingEnabled}
                            variant="individual"
                          />
                        </div>
                        <div>
                          <p className="rounded-lg bg-slate-100 px-2 text-slate-700">
                            {convertFloatToNDecimal(result.percentage, 2)}%
                          </p>
                        </div>
                      </div>
                      <p className="flex w-32 items-end justify-end text-slate-600">
                        {result.count} {result.count === 1 ? t("common.response") : t("common.responses")}
                      </p>
                    </div>
                    <ProgressBar barColor="bg-brand-dark" progress={result.percentage / 100} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </TabsContent>
      </Tabs>
      {elementSummary.dismissed && elementSummary.dismissed.count > 0 && (
        <div className="rounded-b-lg border-t bg-white px-6 py-4">
          <div key="dismissed">
            <div className="text flex justify-between px-2">
              <p className="font-semibold text-slate-700">{t("common.dismissed")}</p>
              <p className="flex w-32 items-end justify-end text-slate-600">
                {elementSummary.dismissed.count}{" "}
                {elementSummary.dismissed.count === 1 ? t("common.response") : t("common.responses")}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
